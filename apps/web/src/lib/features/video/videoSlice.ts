import { createSlice, current, type PayloadAction } from '@reduxjs/toolkit';
import {
  createHistory,
  redo as histRedo,
  undo as histUndo,
  canRedo as histCanRedo,
  canUndo as histCanUndo,
  type History,
} from '@/lib/editor/history';
import {
  addClip as tlAddClip,
  moveClip as tlMoveClip,
  removeClip as tlRemoveClip,
  setClipSpeed as tlSetSpeed,
  splitClip as tlSplit,
  timelineDuration,
  trimClip as tlTrim,
  updateClip as tlUpdate,
} from '@/lib/video/timeline';
import { emptyVideoDocument, type Clip, type VideoDocument } from '@/lib/video/types';

type VideoHistory = History<VideoDocument>;

export interface VideoState {
  projectId: string | null;
  title: string;
  history: VideoHistory;
  selectedClipId: string | null;
  playhead: number; // ms
  playing: boolean;
  /** Timeline zoom: pixels per second. */
  pxPerSecond: number;
  dirty: boolean;
}

const initialState: VideoState = {
  projectId: null,
  title: 'Untitled video',
  history: createHistory(emptyVideoDocument()),
  selectedClipId: null,
  playhead: 0,
  playing: false,
  pxPerSecond: 80,
  dirty: false,
};

const LIMIT = 100;

function push(state: VideoState, next: VideoDocument) {
  state.history.past.push(current(state.history.present));
  if (state.history.past.length > LIMIT) state.history.past.shift();
  state.history.present = next;
  state.history.future = [];
  state.dirty = true;
}

const slice = createSlice({
  name: 'video',
  initialState,
  reducers: {
    loadVideo(
      state,
      action: PayloadAction<{ id: string; title: string; document: VideoDocument }>,
    ) {
      state.projectId = action.payload.id;
      state.title = action.payload.title;
      state.history = createHistory(action.payload.document, LIMIT);
      state.selectedClipId = null;
      state.playhead = 0;
      state.playing = false;
      state.dirty = false;
    },

    addClip(state, action: PayloadAction<{ trackId: string; clip: Clip }>) {
      push(state, tlAddClip(current(state.history.present), action.payload.trackId, action.payload.clip));
      state.selectedClipId = action.payload.clip.id;
    },
    moveClip(state, action: PayloadAction<{ clipId: string; start: number; toTrackId?: string }>) {
      const { clipId, start, toTrackId } = action.payload;
      push(state, tlMoveClip(current(state.history.present), clipId, start, toTrackId));
    },
    trimClip(state, action: PayloadAction<{ clipId: string; edge: 'start' | 'end'; deltaMs: number }>) {
      const { clipId, edge, deltaMs } = action.payload;
      push(state, tlTrim(current(state.history.present), clipId, edge, deltaMs));
    },
    splitAtPlayhead(state) {
      if (!state.selectedClipId) return;
      push(state, tlSplit(current(state.history.present), state.selectedClipId, state.playhead));
    },
    removeSelected(state) {
      if (!state.selectedClipId) return;
      push(state, tlRemoveClip(current(state.history.present), state.selectedClipId));
      state.selectedClipId = null;
    },
    setClipSpeed(state, action: PayloadAction<{ clipId: string; speed: number }>) {
      push(state, tlSetSpeed(current(state.history.present), action.payload.clipId, action.payload.speed));
    },
    updateClip(state, action: PayloadAction<{ clipId: string; patch: Partial<Clip> }>) {
      push(state, tlUpdate(current(state.history.present), action.payload.clipId, action.payload.patch));
    },

    undo(state) {
      state.history = histUndo(current(state.history));
      state.dirty = true;
    },
    redo(state) {
      state.history = histRedo(current(state.history));
      state.dirty = true;
    },

    selectClip(state, action: PayloadAction<string | null>) {
      state.selectedClipId = action.payload;
    },
    setPlayhead(state, action: PayloadAction<number>) {
      const dur = timelineDuration(current(state.history.present));
      state.playhead = Math.max(0, Math.min(dur, Math.round(action.payload)));
      if (state.playhead >= dur) state.playing = false;
    },
    play(state) {
      if (timelineDuration(current(state.history.present)) > 0) state.playing = true;
    },
    pause(state) {
      state.playing = false;
    },
    setZoom(state, action: PayloadAction<number>) {
      state.pxPerSecond = Math.max(20, Math.min(240, action.payload));
    },
    setTitle(state, action: PayloadAction<string>) {
      state.title = action.payload;
    },
    markSaved(state) {
      state.dirty = false;
    },
  },
});

export const videoActions = slice.actions;
export default slice.reducer;

// ── Selectors ──────────────────────────────────────────────────────
import type { RootState } from '@/lib/store';

export const selectVideoDoc = (s: RootState) => s.video.history.present;
export const selectSelectedClipId = (s: RootState) => s.video.selectedClipId;
export const selectPlayhead = (s: RootState) => s.video.playhead;
export const selectPlaying = (s: RootState) => s.video.playing;
export const selectVideoCanUndo = (s: RootState) => histCanUndo(s.video.history);
export const selectVideoCanRedo = (s: RootState) => histCanRedo(s.video.history);
export const selectVideoDuration = (s: RootState) => timelineDuration(s.video.history.present);
export const selectVideoMeta = (s: RootState) => ({
  projectId: s.video.projectId,
  title: s.video.title,
  pxPerSecond: s.video.pxPerSecond,
  dirty: s.video.dirty,
});
