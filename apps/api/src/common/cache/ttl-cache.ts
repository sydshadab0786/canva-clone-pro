/**
 * A tiny in-process TTL cache. Suitable for hot, low-cardinality reads
 * (template categories, plans) to shave DB round-trips. For multi-instance
 * deployments this interface is intentionally minimal so a Redis-backed
 * implementation can replace it without touching call sites.
 *
 * `nowFn` is injectable so time-dependent behaviour is unit-testable without
 * mocking the clock globally.
 */
export interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly nowFn: () => number = () => Date.now(),
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.nowFn() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.store.set(key, { value, expiresAt: this.nowFn() + this.ttlMs });
  }

  /** Return the cached value or compute, cache, and return it. */
  async wrap(key: string, factory: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await factory();
    this.set(key, value);
    return value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
