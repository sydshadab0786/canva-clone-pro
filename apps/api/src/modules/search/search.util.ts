import { Prisma } from '@prisma/client';

export type SearchKind = 'project' | 'template';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  type: string;
  thumbnailUrl: string | null;
}

/** Normalize a raw query: trim, collapse whitespace, cap length. */
export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').slice(0, 120);
}

/**
 * Postgres fallback WHERE builders (pure, unit-tested). Projects are scoped to
 * the requesting user; templates are a shared, public corpus.
 */
export function buildProjectWhere(userId: string, q: string): Prisma.ProjectWhereInput {
  return {
    ownerId: userId,
    deletedAt: null,
    title: { contains: q, mode: Prisma.QueryMode.insensitive },
  };
}

export function buildTemplateWhere(q: string): Prisma.TemplateWhereInput {
  return {
    OR: [
      { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
      { tags: { has: q.toLowerCase() } },
    ],
  };
}
