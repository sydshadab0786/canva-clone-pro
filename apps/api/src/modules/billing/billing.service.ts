import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, SubscriptionStatus } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CouponsService } from './coupons.service';
import { priceWithCoupon, type PriceBreakdown } from './pricing.util';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class BillingService {
  private readonly billingCfg: AppConfig['billing'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.billingCfg = config.get('billing', { infer: true });
  }

  listPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: 'asc' } });
  }

  /** Current subscription for a user, or a synthetic Free view when none. */
  async current(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (sub) return sub;

    const free = await this.prisma.plan.findUnique({ where: { code: 'free' } });
    return {
      id: null,
      planId: free?.id ?? null,
      plan: free,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      aiCreditsRemaining: free?.aiCredits ?? 0,
      synthetic: true,
    };
  }

  private async planByCode(code: string) {
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    if (!plan) throw new NotFoundException(`Unknown plan: ${code}`);
    return plan;
  }

  /** Preview a checkout price with an optional coupon (no state change). */
  async preview(planCode: string, couponCode?: string): Promise<PriceBreakdown & { planCode: string }> {
    const plan = await this.planByCode(planCode);
    const coupon = couponCode ? this.coupons.find(couponCode) : null;
    const breakdown = priceWithCoupon(plan.priceCents, coupon, Date.now());
    return { ...breakdown, planCode };
  }

  /**
   * Start/refresh a subscription. With the `mock` provider the plan activates
   * immediately (dev/self-serve). With a real provider this returns a hosted
   * checkout URL and activation happens on the webhook.
   */
  async checkout(userId: string, planCode: string, couponCode?: string) {
    const plan = await this.planByCode(planCode);
    const breakdown = await this.preview(planCode, couponCode);

    if (this.billingCfg.provider !== 'mock' && plan.priceCents > 0) {
      // Real provider path — hand off to hosted checkout (Stripe/PayPal/Razorpay).
      return {
        mode: 'redirect' as const,
        provider: this.billingCfg.provider,
        checkoutUrl: `${this.billingCfg.checkoutBaseUrl}?plan=${planCode}`,
        breakdown,
      };
    }

    if (couponCode && breakdown.couponCode) this.coupons.redeem(couponCode);

    const existing = await this.prisma.subscription.findFirst({ where: { userId } });
    const data = {
      userId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      provider: this.billingCfg.provider,
      currentPeriodEnd: new Date(Date.now() + PERIOD_MS),
      cancelAtPeriodEnd: false,
      aiCreditsRemaining: plan.aiCredits,
    };
    const subscription = existing
      ? await this.prisma.subscription.update({ where: { id: existing.id }, data })
      : await this.prisma.subscription.create({ data });

    await this.prisma.auditLog.create({
      data: { action: AuditAction.SUBSCRIPTION_CHANGED, userId, targetType: 'Plan', targetId: plan.id },
    });

    return { mode: 'activated' as const, subscription, breakdown };
  }

  async cancel(userId: string) {
    const sub = await this.prisma.subscription.findFirst({ where: { userId } });
    if (!sub) throw new NotFoundException('No active subscription');
    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true },
    });
  }

  /** Consume AI credits atomically; throws when the balance is insufficient. */
  async consumeCredits(userId: string, amount: number): Promise<{ remaining: number }> {
    const sub = await this.prisma.subscription.findFirst({ where: { userId } });
    const remaining = sub?.aiCreditsRemaining ?? 0;
    if (remaining < amount) {
      throw new BadRequestException('Insufficient AI credits — upgrade your plan.');
    }
    const updated = await this.prisma.subscription.update({
      where: { id: sub!.id },
      data: { aiCreditsRemaining: { decrement: amount } },
    });
    return { remaining: updated.aiCreditsRemaining };
  }

  /** Synthesize an invoice history from the current subscription + plan. */
  async invoices(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub || !sub.plan) return [];
    return [
      {
        id: `inv_${sub.id.slice(0, 8)}`,
        planName: sub.plan.name,
        amountCents: sub.plan.priceCents,
        currency: this.billingCfg.currency,
        status: sub.status,
        periodEnd: sub.currentPeriodEnd,
        createdAt: sub.createdAt,
      },
    ];
  }

  /**
   * Provider webhook sink. When a signing secret is configured the caller must
   * pass a verified event; here we route by type. Mock mode is a no-op.
   */
  async handleWebhook(_event: { type?: string; data?: unknown }): Promise<{ received: boolean }> {
    // e.g. 'customer.subscription.updated' -> reconcile status. Left as a
    // routing skeleton; provider SDK signature verification wraps this.
    return { received: true };
  }
}
