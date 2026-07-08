/**
 * Video timeline model. Times are in **milliseconds**.
 *
 * A timeline is a set of tracks; each track holds non-overlapping clips laid
 * out along the time axis. A clip references source media (an uploaded asset)
 * or is a generated overlay (text/shape). `trimIn`/`trimOut` window into the
 * source; `start` places the clip on the timeline; `speed` scales playback.
 *
 * The model is flat + serializable so it persists directly in
 * `Project.document` and is trivially snapshot-able for undo/redo.
 */

export type ClipKind = 'video' | 'image' | 'audio' | 'text';
export type TrackKind = 'video' | 'audio' | 'overlay';
export type TransitionKind = 'none' | 'fade' | 'slide' | 'wipe';

export interface Clip {
  id: string;
  kind: ClipKind;
  name: string;
  /** Source asset URL (video/image/audio) — empty for pure text overlays. */
  src: string;
  /** Position on the timeline (ms). */
  start: number;
  /** Rendered duration on the timeline (ms), after speed is applied. */
  duration: number;
  /** Window into the source media (ms). For images/text, trimIn=0. */
  trimIn: number;
  trimOut: number;
  speed: number; // 1 = normal
  volume: number; // 0..1 (audio/video)
  transitionIn: TransitionKind;
  // Overlay/text properties (used when kind === 'text').
  text?: string;
  fill?: string;
  fontSize?: number;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: Clip[];
}

export interface VideoDocument {
  version: number;
  /** Output canvas size. */
  width: number;
  height: number;
  fps: number;
  /** Background colour behind transparent regions. */
  background: string;
  tracks: Track[];
}

export function emptyVideoDocument(width = 1920, height = 1080, fps = 30): VideoDocument {
  return {
    version: 1,
    width,
    height,
    fps,
    background: '#000000',
    tracks: [
      { id: 'track_video', kind: 'video', name: 'Video', muted: false, locked: false, clips: [] },
      { id: 'track_overlay', kind: 'overlay', name: 'Overlay', muted: false, locked: false, clips: [] },
      { id: 'track_audio', kind: 'audio', name: 'Audio', muted: false, locked: false, clips: [] },
    ],
  };
}
