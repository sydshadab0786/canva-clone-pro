import { Client } from '@elastic/elasticsearch';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../common/config/configuration';
import type { SearchResult } from './search.util';

export const TEMPLATE_INDEX = 'ccp_templates';
export const PROJECT_INDEX = 'ccp_projects';

/**
 * Thin Elasticsearch wrapper with graceful degradation: if the cluster is
 * unreachable at boot, `available` stays false and callers fall back to
 * Postgres. This keeps local/dev and CI green without a running ES node,
 * while production benefits from real full-text + fuzzy search.
 */
@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly client: Client;
  private _available = false;

  constructor(config: ConfigService<AppConfig, true>) {
    const node = config.get('elasticsearch', { infer: true }).node;
    this.client = new Client({ node, requestTimeout: 2000, maxRetries: 1 });
  }

  get available(): boolean {
    return this._available;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.ping();
      this._available = true;
      await this.ensureIndices();
      this.logger.log('Elasticsearch connected');
    } catch {
      this._available = false;
      this.logger.warn('Elasticsearch unavailable — search will use Postgres fallback');
    }
  }

  private async ensureIndices(): Promise<void> {
    for (const index of [TEMPLATE_INDEX, PROJECT_INDEX]) {
      const exists = await this.client.indices.exists({ index });
      if (!exists) {
        await this.client.indices.create({
          index,
          mappings: {
            properties: {
              title: { type: 'text' },
              tags: { type: 'keyword' },
              type: { type: 'keyword' },
              ownerId: { type: 'keyword' },
              thumbnailUrl: { type: 'keyword', index: false },
            },
          },
        });
      }
    }
  }

  /** Best-effort index of a document; swallows errors so writes never fail a request. */
  async index(index: string, id: string, body: Record<string, unknown>): Promise<void> {
    if (!this._available) return;
    try {
      await this.client.index({ index, id, document: body });
    } catch (err) {
      this.logger.warn(`ES index failed (${index}/${id}): ${(err as Error).message}`);
    }
  }

  async remove(index: string, id: string): Promise<void> {
    if (!this._available) return;
    try {
      await this.client.delete({ index, id });
    } catch {
      /* ignore missing docs */
    }
  }

  /** Fuzzy multi-index search. Returns [] if ES is unavailable. */
  async search(q: string, userId: string, limit = 20): Promise<SearchResult[]> {
    if (!this._available) return [];
    const res = await this.client.search<Record<string, unknown>>({
      index: [TEMPLATE_INDEX, PROJECT_INDEX],
      size: limit,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: q,
                fields: ['title^2', 'tags'],
                fuzziness: 'AUTO',
              },
            },
          ],
          // A template (no ownerId) OR a project owned by the requester.
          should: [
            { bool: { must_not: { exists: { field: 'ownerId' } } } },
            { term: { ownerId: userId } },
          ],
          minimum_should_match: 1,
        },
      },
    });

    return res.hits.hits.map((hit) => {
      const src = hit._source ?? {};
      return {
        kind: hit._index === TEMPLATE_INDEX ? 'template' : 'project',
        id: hit._id ?? '',
        title: (src.title as string) ?? '',
        type: (src.type as string) ?? '',
        thumbnailUrl: (src.thumbnailUrl as string) ?? null,
      } satisfies SearchResult;
    });
  }
}
