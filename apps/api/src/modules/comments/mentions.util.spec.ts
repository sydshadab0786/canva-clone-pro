import { describe, expect, it } from 'vitest';
import { parseMentions } from './mentions.util';

describe('parseMentions', () => {
  it('extracts unique, lowercased usernames', () => {
    expect(parseMentions('hey @Jane and @bob, also @jane again')).toEqual(['jane', 'bob']);
  });

  it('ignores emails and too-short handles', () => {
    expect(parseMentions('mail me at jane@example.com or ping @ab')).toEqual([]);
  });

  it('matches a mention at the very start', () => {
    expect(parseMentions('@alice look here')).toEqual(['alice']);
  });

  it('returns empty for no mentions', () => {
    expect(parseMentions('no mentions here')).toEqual([]);
  });

  it('respects the 30-char cap and underscores', () => {
    expect(parseMentions('@user_name_123 hi')).toEqual(['user_name_123']);
  });
});
