import { describe, expect, it } from 'vitest';
import { buildStorageKey, publicUrl, sanitizeFilename } from './storage.util';

describe('storage.util', () => {
  it('sanitizes filenames to url-safe slugs, preserving extension', () => {
    expect(sanitizeFilename('My Photo (Final).PNG')).toBe('my-photo-final.png');
    expect(sanitizeFilename('  résumé v2.pdf ')).toMatch(/\.pdf$/);
    expect(sanitizeFilename('....')).toBe('file');
  });

  it('caps very long base names', () => {
    const long = `${'a'.repeat(200)}.jpg`;
    const out = sanitizeFilename(long);
    expect(out.endsWith('.jpg')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(64);
  });

  it('builds an owner + date scoped key with a random segment', () => {
    const key = buildStorageKey('user123', 'Cat Pic.jpg', new Date(Date.UTC(2026, 2, 4)));
    expect(key).toMatch(/^user123\/2026\/03\/[0-9a-f]{16}-cat-pic\.jpg$/);
  });

  it('generates distinct keys for the same file (collision resistance)', () => {
    const a = buildStorageKey('u', 'x.png');
    const b = buildStorageKey('u', 'x.png');
    expect(a).not.toBe(b);
  });

  it('builds a public url without double slashes', () => {
    expect(publicUrl('http://localhost:9000/ccp-media/', 'a/b.png')).toBe(
      'http://localhost:9000/ccp-media/a/b.png',
    );
    expect(publicUrl('http://localhost:9000/ccp-media', 'a/b.png')).toBe(
      'http://localhost:9000/ccp-media/a/b.png',
    );
  });
});
