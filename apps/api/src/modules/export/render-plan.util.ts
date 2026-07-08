/**
 * Flattens a video timeline document into an ordered render plan — the input a
 * renderer (ffmpeg worker) consumes to composite the final MP4. Pure + tested.
 *
 * The plan expresses, per contributing clip, where it sits on the output
 * timeline and which window of its source to pull, accounting for speed.
 */

interface Clip {
  id: string;
  kind: string;
  src: string;
  start: number;
  duration: number;
  trimIn: number;
  trimOut: number;
  speed: number;
  volume: number;
  text?: string;
}
interface Track {
  id: string;
  kind: string;
  muted?: boolean;
  clips: Clip[];
}
interface VideoDoc {
  width: number;
  height: number;
  fps: number;
  background?: string;
  tracks: Track[];
}

export interface RenderSegment {
  clipId: string;
  trackKind: string;
  kind: string;
  src: string;
  text?: string;
  timelineStart: number;
  timelineEnd: number;
  sourceIn: number;
  sourceOut: number;
  speed: number;
  volume: number;
}

export interface RenderPlan {
  width: number;
  height: number;
  fps: number;
  background: string;
  durationMs: number;
  frameCount: number;
  segments: RenderSegment[];
}

export function buildRenderPlan(doc: VideoDoc): RenderPlan {
  const segments: Array<RenderSegment & { _seq: number }> = [];
  let duration = 0;
  let seq = 0;

  for (const track of doc.tracks) {
    // A muted track contributes no audio; audio tracks that are muted are dropped.
    const muted = track.muted === true;
    for (const clip of track.clips) {
      if (clip.duration <= 0) continue;
      const timelineEnd = clip.start + clip.duration;
      duration = Math.max(duration, timelineEnd);
      segments.push({
        _seq: seq++,
        clipId: clip.id,
        trackKind: track.kind,
        kind: clip.kind,
        src: clip.src,
        text: clip.text,
        timelineStart: clip.start,
        timelineEnd,
        sourceIn: clip.trimIn,
        sourceOut: clip.trimOut,
        speed: clip.speed,
        volume: track.kind === 'audio' && muted ? 0 : clip.volume,
      });
    }
  }

  // Render order: earliest first; ties broken by document order so video
  // tracks composite beneath overlay/audio declared later.
  segments.sort((a, b) => a.timelineStart - b.timelineStart || a._seq - b._seq);

  const fps = doc.fps || 30;
  return {
    width: doc.width,
    height: doc.height,
    fps,
    background: doc.background ?? '#000000',
    durationMs: duration,
    frameCount: Math.ceil((duration / 1000) * fps),
    segments: segments.map(({ _seq, ...s }) => s),
  };
}
