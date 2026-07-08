import { Injectable } from '@nestjs/common';
import type { Coupon } from './pricing.util';

/**
 * In-memory coupon registry. In production this is a `coupons` table with an
 * admin CRUD; the lookup interface stays identical so the swap is contained.
 */
@Injectable()
export class CouponsService {
  private readonly coupons = new Map<string, Coupon>([
    ['WELCOME20', { code: 'WELCOME20', type: 'percent', value: 20 }],
    ['SAVE10', { code: 'SAVE10', type: 'fixed', value: 1000, minAmountCents: 2000 }],
    ['LAUNCH50', { code: 'LAUNCH50', type: 'percent', value: 50, maxRedemptions: 100, timesRedeemed: 0 }],
  ]);

  find(code: string): Coupon | null {
    return this.coupons.get(code.trim().toUpperCase()) ?? null;
  }

  /** Record a redemption (best-effort; no-op if unknown). */
  redeem(code: string): void {
    const c = this.coupons.get(code.trim().toUpperCase());
    if (c) c.timesRedeemed = (c.timesRedeemed ?? 0) + 1;
  }
}
