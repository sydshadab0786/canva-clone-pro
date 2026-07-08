import { describe, expect, it } from 'vitest';
import { dailyBuckets, toUtcDay } from './bucket.util';

const DAY = 86_400_000;
// A fixed reference day to keep the test deterministic.
const END = Date.UTC(2026, 6, 8, 12, 0, 0); // 2026-07-08

describe('dailyBuckets', () => {
  it('creates N continuous daily buckets ending at endMs', () => {
    const buckets = dailyBuckets([], END, 7);
    expect(buckets).toHaveLength(7);
    expect(buckets[6]!.date).toBe('2026-07-08');
    expect(buckets[0]!.date).toBe('2026-07-02');
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it('counts timestamps into the correct day', () => {
    const ts = [END, END - DAY, END - DAY, END - 6 * DAY];
    const buckets = dailyBuckets(ts, END, 7);
    expect(buckets.find((b) => b.date === '2026-07-08')!.count).toBe(1);
    expect(buckets.find((b) => b.date === '2026-07-07')!.count).toBe(2);
    expect(buckets.find((b) => b.date === '2026-07-02')!.count).toBe(1);
  });

  it('ignores timestamps outside the window', () => {
    const buckets = dailyBuckets([END - 30 * DAY], END, 7);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it('formats a UTC day', () => {
    expect(toUtcDay(END)).toBe('2026-07-08');
  });
});
