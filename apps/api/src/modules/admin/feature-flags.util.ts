import { createHash } from 'node:crypto';

/**
 * Feature-flag evaluation. A flag can be fully on/off or rolled out to a stable
 * percentage of users. Rollout is deterministic per (flag, user) so a user's
 * bucket never flickers between requests. Pure + unit-tested.
 */
export interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  /** 0..100; only consulted when `enabled` is true. */
  rolloutPercent: number;
}

/** Map (flag, user) to a stable 0..99 bucket via a hash. */
export function bucketFor(flagKey: string, userId: string): number {
  const digest = createHash('sha256').update(`${flagKey}:${userId}`).digest();
  // First two bytes → 0..65535 → 0..99.
  const n = (digest[0]! << 8) | digest[1]!;
  return n % 100;
}

export function isFlagEnabled(flag: FeatureFlag | undefined, userId: string): boolean {
  if (!flag || !flag.enabled) return false;
  if (flag.rolloutPercent >= 100) return true;
  if (flag.rolloutPercent <= 0) return false;
  return bucketFor(flag.key, userId) < flag.rolloutPercent;
}
