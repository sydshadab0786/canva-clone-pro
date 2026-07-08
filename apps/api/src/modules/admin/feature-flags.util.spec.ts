import { describe, expect, it } from 'vitest';
import { bucketFor, isFlagEnabled, type FeatureFlag } from './feature-flags.util';

const flag = (over: Partial<FeatureFlag> = {}): FeatureFlag => ({
  key: 'new-editor',
  description: '',
  enabled: true,
  rolloutPercent: 100,
  ...over,
});

describe('feature flags', () => {
  it('respects the master switch', () => {
    expect(isFlagEnabled(flag({ enabled: false }), 'u1')).toBe(false);
    expect(isFlagEnabled(undefined, 'u1')).toBe(false);
  });

  it('is fully on at 100% and off at 0%', () => {
    expect(isFlagEnabled(flag({ rolloutPercent: 100 }), 'u1')).toBe(true);
    expect(isFlagEnabled(flag({ rolloutPercent: 0 }), 'u1')).toBe(false);
  });

  it('gives a stable bucket per (flag, user)', () => {
    expect(bucketFor('new-editor', 'user-42')).toBe(bucketFor('new-editor', 'user-42'));
    expect(bucketFor('new-editor', 'user-42')).toBeGreaterThanOrEqual(0);
    expect(bucketFor('new-editor', 'user-42')).toBeLessThan(100);
  });

  it('rolls out to roughly the configured percentage across many users', () => {
    let on = 0;
    const N = 2000;
    for (let i = 0; i < N; i += 1) if (isFlagEnabled(flag({ rolloutPercent: 30 }), `user-${i}`)) on += 1;
    const ratio = on / N;
    expect(ratio).toBeGreaterThan(0.24);
    expect(ratio).toBeLessThan(0.36); // ~30% ± tolerance
  });
});
