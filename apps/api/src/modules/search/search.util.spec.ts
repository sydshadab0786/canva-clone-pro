import { describe, expect, it } from 'vitest';
import { buildProjectWhere, buildTemplateWhere, normalizeQuery } from './search.util';

describe('search.util', () => {
  it('normalizes whitespace and caps length', () => {
    expect(normalizeQuery('  hello   world  ')).toBe('hello world');
    expect(normalizeQuery('a'.repeat(200)).length).toBe(120);
    expect(normalizeQuery('   ')).toBe('');
  });

  it('scopes project search to the owner and excludes trashed', () => {
    const where = buildProjectWhere('user1', 'poster');
    expect(where.ownerId).toBe('user1');
    expect(where.deletedAt).toBeNull();
    expect(where.title).toEqual({ contains: 'poster', mode: 'insensitive' });
  });

  it('searches templates by title (insensitive) OR exact lowercased tag', () => {
    const where = buildTemplateWhere('Resume');
    expect(where.OR).toEqual([
      { title: { contains: 'Resume', mode: 'insensitive' } },
      { tags: { has: 'resume' } },
    ]);
  });
});
