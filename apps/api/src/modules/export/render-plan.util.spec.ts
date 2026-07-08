import { describe, expect, it } from 'vitest';
import { buildRenderPlan } from './render-plan.util';

const doc = {
  width: 1920,
  height: 1080,
  fps: 30,
  background: '#000000',
  tracks: [
    {
      id: 't_video',
      kind: 'video',
      clips: [
        { id: 'c2', kind: 'video', src: 'b.mp4', start: 4000, duration: 3000, trimIn: 0, trimOut: 3000, speed: 1, volume: 1 },
        { id: 'c1', kind: 'video', src: 'a.mp4', start: 0, duration: 4000, trimIn: 500, trimOut: 4500, speed: 1, volume: 1 },
      ],
    },
    {
      id: 't_audio',
      kind: 'audio',
      muted: true,
      clips: [{ id: 'a1', kind: 'audio', src: 'm.mp3', start: 0, duration: 7000, trimIn: 0, trimOut: 7000, speed: 1, volume: 0.8 }],
    },
  ],
};

describe('buildRenderPlan', () => {
  it('computes output metadata and total duration', () => {
    const plan = buildRenderPlan(doc);
    expect(plan.width).toBe(1920);
    expect(plan.fps).toBe(30);
    expect(plan.durationMs).toBe(7000);
    expect(plan.frameCount).toBe(210); // 7s * 30fps
  });

  it('emits one segment per clip, ordered by timeline start', () => {
    const plan = buildRenderPlan(doc);
    expect(plan.segments.map((s) => s.clipId)).toEqual(['c1', 'a1', 'c2']);
    expect(plan.segments[0]).toMatchObject({ timelineStart: 0, timelineEnd: 4000, sourceIn: 500, sourceOut: 4500 });
  });

  it('zeroes volume for muted audio tracks', () => {
    const plan = buildRenderPlan(doc);
    const audio = plan.segments.find((s) => s.clipId === 'a1')!;
    expect(audio.volume).toBe(0);
  });

  it('skips zero-duration clips', () => {
    const empty = { ...doc, tracks: [{ id: 't', kind: 'video', clips: [{ id: 'z', kind: 'video', src: '', start: 0, duration: 0, trimIn: 0, trimOut: 0, speed: 1, volume: 1 }] }] };
    expect(buildRenderPlan(empty).segments).toHaveLength(0);
  });
});
