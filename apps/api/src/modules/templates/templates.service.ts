import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TtlCache } from '../../common/cache/ttl-cache';
import { ListTemplatesQueryDto } from './dto/templates.dto';

// Lightweight card payload — the heavy `document` is only sent on detail/use.
const CARD_SELECT = {
  id: true,
  title: true,
  type: true,
  category: true,
  thumbnailUrl: true,
  width: true,
  height: true,
  isPremium: true,
  tags: true,
  usageCount: true,
} satisfies Prisma.TemplateSelect;

@Injectable()
export class TemplatesService {
  // Categories change rarely; cache for 60s to cut repeated groupBy queries.
  private readonly categoryCache = new TtlCache<{ category: string; count: number }[]>(60_000);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTemplatesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;
    const where: Prisma.TemplateWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.premium !== undefined ? { isPremium: query.premium } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { tags: { has: query.search.toLowerCase() } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.template.findMany({
        where,
        select: CARD_SELECT,
        orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.template.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  categories() {
    return this.categoryCache.wrap('all', async () => {
      const rows = await this.prisma.template.groupBy({
        by: ['category'],
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
      });
      return rows.map((r) => ({ category: r.category, count: r._count.category }));
    });
  }

  async getById(id: string) {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  /** Create a new user project from a template's document. */
  async use(userId: string, id: string) {
    const template = await this.getById(id);

    const [project] = await this.prisma.$transaction([
      this.prisma.project.create({
        data: {
          ownerId: userId,
          title: template.title,
          type: template.type,
          width: template.width,
          height: template.height,
          templateId: template.id,
          document: template.document as Prisma.InputJsonValue,
          thumbnailUrl: template.thumbnailUrl,
        },
      }),
      this.prisma.template.update({
        where: { id },
        data: { usageCount: { increment: 1 } },
      }),
      this.prisma.auditLog.create({
        data: { action: AuditAction.PROJECT_CREATED, userId, targetType: 'Template', targetId: id },
      }),
    ]);

    return project;
  }
}
