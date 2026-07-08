/**
 * Pure operations over a VideoDocument. Every function returns a NEW document
 * so the video editor can snapshot for undo/redo. No framework imports.
 */
import type { Clip, ClipKind, Track, TrackKind, VideoDocument } from './types';

let counter = 0;
export function createClipId(prefix = 'clip'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
}

const DEFAULT_IMAGE_MS = 4000;
const DEFAULT_TEXT_MS = 3000;

// ── Factories ──────────────────────────────────────────────────────

export function makeVideoClip(src: string, sourceDurationMs: number, over: Partial<Clip> = {}): Clip {
  return {
    id: over.id ?? createClipId('video'),
    kind: 'video',
    name: over.name ?? 'Video clip',
    src,
    start: over.start ?? 0,
    duration: over.duration ?? sourceDurationMs,
    trimIn: over.trimIn ?? 0,
    trimOut: over.trimOut ?? sourceDurationMs,
    speed: over.speed ?? 1,
    volume: over.volume ?? 1,
    transitionIn: over.transitionIn ?? 'none',
  };
}

export function makeImageClip(src: string, over: Partial<Clip> = {}): Clip {
  const duration = over.duration ?? DEFAULT_IMAGE_MS;
  return {
    id: over.id ?? createClipId('image'),
    kind: 'image',
    name: over.name ?? 'Image',
    src,
    start: over.start ?? 0,
    duration,
    trimIn: 0,
    trimOut: duration,
    speed: 1,
    volume: 0,
    transitionIn: over.transitionIn ?? 'none',
  };
}

export function makeTextClip(text: string, over: Partial<Clip> = {}): Clip {
  const duration = over.duration ?? DEFAULT_TEXT_MS;
  return {
    id: over.id ?? createClipId('text'),
    kind: 'text',
    name: over.name ?? (text.slice(0, 20) || 'Text'),
    src: '',
    start: over.start ?? 0,
    duration,
    trimIn: 0,
    trimOut: duration,
    speed: 1,
    volume: 0,
    transitionIn: over.transitionIn ?? 'none',
    text,
    fill: over.fill ?? '#ffffff',
    fontSize: over.fontSize ?? 64,
  };
}

export function makeAudioClip(src: string, sourceDurationMs: number, over: Partial<Clip> = {}): Clip {
  return {
    id: over.id ?? createClipId('audio'),
    kind: 'audio',
    name: over.name ?? 'Audio',
    src,
    start: over.start ?? 0,
    duration: over.duration ?? sourceDurationMs,
    trimIn: over.trimIn ?? 0,
    trimOut: over.trimOut ?? sourceDurationMs,
    speed: 1,
    volume: over.volume ?? 1,
    transitionIn: 'none',
  };
}

// ── Queries ────────────────────────────────────────────────────────

export function findClip(doc: VideoDocument, clipId: string): { track: Track; clip: Clip } | null {
  for (const track of doc.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

export function trackEnd(track: Track): number {
  return track.clips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
}

export function timelineDuration(doc: VideoDocument): number {
  return doc.tracks.reduce((max, t) => Math.max(max, trackEnd(t)), 0);
}

export const defaultTrackForKind = (kind: ClipKind): TrackKind =>
  kind === 'audio' ? 'audio' : kind === 'video' || kind === 'image' ? 'video' : 'overlay';

// ── Mutations (immutable) ──────────────────────────────────────────

function mapTrack(doc: VideoDocument, trackId: string, fn: (t: Track) => Track): VideoDocument {
  return { ...doc, tracks: doc.tracks.map((t) => (t.id === trackId ? fn(t) : t)) };
}

function mapClip(doc: VideoDocument, clipId: string, fn: (c: Clip) => Clip): VideoDocument {
  return {
    ...doc,
    tracks: doc.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => (c.id === clipId ? fn(c) : c)),
    })),
  };
}

/** Append a clip to a track, snapping its start to the current track end. */
export function addClip(doc: VideoDocument, trackId: string, clip: Clip): VideoDocument {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return doc;
  const placed: Clip = { ...clip, start: trackEnd(track) };
  return mapTrack(doc, trackId, (t) => ({ ...t, clips: [...t.clips, placed] }));
}

/** Move a clip along its track (and optionally to another track). start clamped to >= 0. */
export function moveClip(doc: VideoDocument, clipId: string, newStart: number, toTrackId?: string): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found) return doc;
  const start = Math.max(0, Math.round(newStart));

  if (!toTrackId || toTrackId === found.track.id) {
    return mapClip(doc, clipId, (c) => ({ ...c, start }));
  }
  // Cross-track move: remove from source, add to destination.
  const moved: Clip = { ...found.clip, start };
  return {
    ...doc,
    tracks: doc.tracks.map((t) => {
      if (t.id === found.track.id) return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
      if (t.id === toTrackId) return { ...t, clips: [...t.clips, moved] };
      return t;
    }),
  };
}

/**
 * Trim a clip edge. `edge: 'start'` moves the left edge (adjusting start,
 * duration and trimIn); `edge: 'end'` moves the right edge (duration + trimOut).
 * Respects a minimum duration and the available source window.
 */
export function trimClip(
  doc: VideoDocument,
  clipId: string,
  edge: 'start' | 'end',
  deltaMs: number,
  minDuration = 100,
): VideoDocument {
  return mapClip(doc, clipId, (c) => {
    const sourceDelta = deltaMs * c.speed;
    if (edge === 'start') {
      const newDuration = c.duration - deltaMs;
      if (newDuration < minDuration) return c;
      const newTrimIn = c.trimIn + sourceDelta;
      if (c.kind !== 'image' && c.kind !== 'text' && newTrimIn < 0) return c;
      return { ...c, start: c.start + deltaMs, duration: newDuration, trimIn: Math.max(0, newTrimIn) };
    }
    const newDuration = c.duration + deltaMs;
    if (newDuration < minDuration) return c;
    const newTrimOut = c.trimOut + sourceDelta;
    return { ...c, duration: newDuration, trimOut: newTrimOut };
  });
}

/** Split a clip at an absolute timeline time (ms), producing two adjacent clips. */
export function splitClip(doc: VideoDocument, clipId: string, atMs: number): VideoDocument {
  const found = findClip(doc, clipId);
  if (!found) return doc;
  const { track, clip } = found;
  const clipEnd = clip.start + clip.duration;
  if (atMs <= clip.start || atMs >= clipEnd) return doc; // split point outside clip

  const leftDuration = atMs - clip.start;
  const sourceConsumed = leftDuration * clip.speed;
  const splitTrimPoint = clip.trimIn + sourceConsumed;

  const left: Clip = { ...clip, duration: leftDuration, trimOut: splitTrimPoint };
  const right: Clip = {
    ...clip,
    id: createClipId(clip.kind),
    start: atMs,
    duration: clipEnd - atMs,
    trimIn: splitTrimPoint,
    transitionIn: 'none',
  };

  return mapTrack(doc, track.id, (t) => ({
    ...t,
    clips: t.clips.flatMap((c) => (c.id === clipId ? [left, right] : [c])),
  }));
}

export function removeClip(doc: VideoDocument, clipId: string): VideoDocument {
  return {
    ...doc,
    tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) })),
  };
}

/** Change playback speed, keeping the source window fixed and rescaling duration. */
export function setClipSpeed(doc: VideoDocument, clipId: string, speed: number): VideoDocument {
  const clamped = Math.max(0.25, Math.min(4, speed));
  return mapClip(doc, clipId, (c) => {
    const sourceLen = c.trimOut - c.trimIn;
    return { ...c, speed: clamped, duration: Math.round(sourceLen / clamped) };
  });
}

export function updateClip(doc: VideoDocument, clipId: string, patch: Partial<Clip>): VideoDocument {
  return mapClip(doc, clipId, (c) => ({ ...c, ...patch }));
}
