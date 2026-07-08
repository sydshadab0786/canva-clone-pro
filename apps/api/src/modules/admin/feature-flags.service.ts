import { Injectable } from '@nestjs/common';
import { isFlagEnabled, type FeatureFlag } from './feature-flags.util';

/**
 * In-memory feature-flag store (would be a `feature_flags` table in prod). The
 * evaluation logic lives in the pure util so it stays testable and identical
 * regardless of the backing store.
 */
@Injectable()
export class FeatureFlagsService {
  private readonly flags = new Map<string, FeatureFlag>([
    ['ai-video-generator', { key: 'ai-video-generator', description: 'AI video generation', enabled: false, rolloutPercent: 0 }],
    ['realtime-collab', { key: 'realtime-collab', description: 'Live multiplayer editing', enabled: true, rolloutPercent: 100 }],
    ['new-templates-gallery', { key: 'new-templates-gallery', description: 'Redesigned templates gallery', enabled: true, rolloutPercent: 50 }],
  ]);

  list(): FeatureFlag[] {
    return [...this.flags.values()];
  }

  upsert(flag: FeatureFlag): FeatureFlag {
    const normalized: FeatureFlag = {
      ...flag,
      rolloutPercent: Math.max(0, Math.min(100, Math.round(flag.rolloutPercent))),
    };
    this.flags.set(flag.key, normalized);
    return normalized;
  }

  isEnabledFor(key: string, userId: string): boolean {
    return isFlagEnabled(this.flags.get(key), userId);
  }

  /** All flags resolved for a specific user (used by the app on load). */
  resolveFor(userId: string): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const flag of this.flags.values()) out[flag.key] = isFlagEnabled(flag, userId);
    return out;
  }
}
