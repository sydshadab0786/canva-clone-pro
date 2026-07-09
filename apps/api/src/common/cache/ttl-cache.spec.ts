import { describe, expect, it } from 'vitest';
import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('stores and returns a value within the TTL', () => {
    let now = 1000;
    const cache = new TtlCache<number>(500, () => now);
    cache.set('a', 42);
    now = 1400;
    expect(cache.get('a')).toBe(42);
  });

  it('expires values after the TTL and evicts them', () => {
    let now = 1000;
    const cache = new TtlCache<number>(500, () => now);
    cache.set('a', 42);
    now = 1500; // exactly at expiry → expired
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('wrap computes once, then serves from cache', async () => {
    let now = 0;
    let calls = 0;
    const cache = new TtlCache<string>(100, () => now);
    const factory = async () => {
      calls += 1;
      return `v${calls}`;
    };
    expect(await cache.wrap('k', factory)).toBe('v1');
    now = 50;
    expect(await cache.wrap('k', factory)).toBe('v1'); // cached
    expect(calls).toBe(1);
    now = 200; // expired
    expect(await cache.wrap('k', factory)).toBe('v2');
    expect(calls).toBe(2);
  });

  it('supports delete and clear', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
