import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ElasticsearchService } from './elasticsearch.service';
import {
  buildProjectWhere,
  buildTemplateWhere,
  normalizeQuery,
  type SearchKind,
  type SearchResult,
} from './search.util';

export interface SearchResponse {
  query: string;
  engine: 'elasticsearch' | 'postgres';
  results: SearchResult[];
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly es: ElasticsearchService,
  ) {}

  async search(userId: string, rawQuery: string, kinds?: SearchKind[]): Promise<SearchResponse> {
    const q = normalizeQuery(rawQuery);
    if (!q) return { query: q, engine: this.es.available ? 'elasticsearch' : 'postgres', results: [] };

    // Prefer Elasticsearch (fuzzy, ranked); fall back to Postgres transparently.
    if (this.es.available) {
      const hits = await this.es.search(q, userId).catch(() => []);
      if (hits.length > 0) {
        return { query: q, engine: 'elasticsearch', results: this.filterKinds(hits, kinds) };
      }
    }

    const results = await this.postgresSearch(userId, q, kinds);
    return { query: q, engine: 'postgres', results };
  }

  private filterKinds(results: SearchResult[], kinds?: SearchKind[]): SearchResult[] {
    if (!kinds || kinds.length === 0) return results;
    return results.filter((r) => kinds.includes(r.kind));
  }

  private async postgresSearch(
    userId: string,
    q: string,
    kinds?: SearchKind[],
  ): Promise<SearchResult[]> {
    const wantProjects = !kinds || kinds.includes('project');
    const wantTemplates = !kinds || kinds.includes('template');

    const [projects, templates] = await Promise.all([
      wantProjects
        ? this.prisma.project.findMany({
            where: buildProjectWhere(userId, q),
            select: { id: true, title: true, type: true, thumbnailUrl: true },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
      wantTemplates
        ? this.prisma.template.findMany({
            where: buildTemplateWhere(q),
            select: { id: true, title: true, type: true, thumbnailUrl: true },
            orderBy: { usageCount: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    return [
      ...projects.map((p) => ({ kind: 'project' as const, ...p })),
      ...templates.map((t) => ({ kind: 'template' as const, ...t })),
    ];
  }
}
