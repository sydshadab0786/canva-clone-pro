import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { dailyBuckets } from './bucket.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Platform-wide headline numbers for the admin dashboard. */
  async overview() {
    const [users, projects, templates, assets, activeSubs] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.project.count({ where: { deletedAt: null } }),
      this.prisma.template.count(),
      this.prisma.asset.count({ where: { deletedAt: null } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    ]);

    // MRR estimate: sum of active subscriptions' plan prices.
    const active = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });
    const mrrCents = active.reduce((sum, s) => sum + (s.plan?.priceCents ?? 0), 0);

    return { users, projects, templates, assets, activeSubscriptions: activeSubs, mrrCents };
  }

  private async series(model: 'user' | 'project', days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows =
      model === 'user'
        ? await this.prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } })
        : await this.prisma.project.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
    return dailyBuckets(rows.map((r) => r.createdAt.getTime()), Date.now(), days);
  }

  signups(days = 30) {
    return this.series('user', days);
  }

  projectsCreated(days = 30) {
    return this.series('project', days);
  }

  async topTemplates(limit = 5) {
    return this.prisma.template.findMany({
      orderBy: { usageCount: 'desc' },
      take: limit,
      select: { id: true, title: true, usageCount: true, category: true },
    });
  }

  /** Activity breakdown by audit action (proxy for feature usage). */
  async activityByAction() {
    const rows = await this.prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });
    return rows.map((r) => ({ action: r.action, count: r._count.action }));
  }
}
