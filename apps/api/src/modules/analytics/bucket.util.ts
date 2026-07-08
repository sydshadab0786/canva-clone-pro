/**
 * Time-series bucketing. Groups timestamps into daily buckets and fills gaps
 * with zeros so charts render a continuous axis. Pure + unit-tested.
 */
export interface DayBucket {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export function toUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Build `days` daily buckets ending at `endMs` (inclusive), counting how many
 * of `timestamps` fall in each day. Buckets are returned oldest → newest.
 */
export function dailyBuckets(timestamps: number[], endMs: number, days: number): DayBucket[] {
  const DAY = 86_400_000;
  const endDay = Date.UTC(
    new Date(endMs).getUTCFullYear(),
    new Date(endMs).getUTCMonth(),
    new Date(endMs).getUTCDate(),
  );

  const buckets: DayBucket[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = toUtcDay(endDay - i * DAY);
    index.set(date, buckets.length);
    buckets.push({ date, count: 0 });
  }

  for (const ts of timestamps) {
    const key = toUtcDay(ts);
    const at = index.get(key);
    if (at !== undefined) buckets[at]!.count += 1;
  }
  return buckets;
}
