import { createSlice, current, type PayloadAction } from '@reduxjs/toolkit';
import {
  addObject as docAdd,
  bringToFront as docToFront,
  duplicateHelper,
  groupObjects,
  removeObjects,
  reorder as docReorder,
  sendToBack as docToBack,
  ungroup,
} from '@/lib/editor/document';
import {
  canRedo as histCanRedo,
  canUndo as histCanUndo,
  createHistory,
  redo as histRedo,
  undo as histUndo,
  type DocumentHistory,
} from '@/lib/editor/history';
import { emptyDocument, type ObjectId, type SceneDocument, type SceneObject } from '@/lib/editor/types';

export interface Viewport {
  scale: number;
  x: number;
  y: number;
}

export interface EditorState {
  projectId: string | null;
  title: string;
  width: number;
  height: number;
  history: DocumentHistory;
  selectedIds: ObjectId[];
  viewport: Viewport;
  grid: boolean;
  snap: boolean;
  dirty: boolean;
  interacting: boolean;
  interactionBase: SceneDocument | null;
}

const initialState: EditorState = {
  projectId: null,
  title: 'Untitled design',
  width: 1080,
  height: 1080,
  history: createHistory(emptyDocument()),
  selectedIds: [],
  viewport: { scale: 1, x: 0, y: 0 },
  grid: true,
  snap: true,
  dirty: false,
  interacting: false,
  interactionBase: null,
};

const HISTORY_LIMIT = 100;

/** Push the current present onto the undo stack and set a new present. */
function pushHistory(state: EditorState, nextDoc: SceneDocument) {
  const prev = current(state.history.present);
  state.history.past.push(prev);
  if (state.history.past.length > HISTORY_LIMIT) state.history.past.shift();
  state.history.present = nextDoc;
  state.history.future = [];
  state.dirty = true;
}

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    loadProject(
      state,
      action: PayloadAction<{
        id: string;
        title: string;
        width: number;
        height: number;
        document: SceneDocument;
      }>,
    ) {
      const { id, title, width, height, document } = action.payload;
      state.projectId = id;
      state.title = title;
      state.width = width;
      state.height = height;
      state.history = createHistory(document, HISTORY_LIMIT);
      state.selectedIds = [];
      state.dirty = false;
    },

    setTitle(state, action: PayloadAction<string>) {
      state.title = action.payload;
      state.dirty = true;
    },

    setBackground(state, action: PayloadAction<string>) {
      const next = { ...current(state.history.present), background: action.payload };
      pushHistory(state, next);
    },

    // ── Object lifecycle ──────────────────────────────────────────
    addObject(state, action: PayloadAction<SceneObject>) {
      const next = docAdd(current(state.history.present), action.payload);
      pushHistory(state, next);
      state.selectedIds = [action.payload.id];
    },

    removeSelected(state) {
      if (state.selectedIds.length === 0) return;
      const next = removeObjects(current(state.history.present), state.selectedIds);
      pushHistory(state, next);
      state.selectedIds = [];
    },

    duplicateSelected(state) {
      if (state.selectedIds.length === 0) return;
      const { doc, newIds } = duplicateHelper(current(state.history.present), state.selectedIds);
      pushHistory(state, doc);
      state.selectedIds = newIds;
    },

    /** Commit a discrete property change (properties panel). */
    updateObjectCommit(
      state,
      action: PayloadAction<{ id: ObjectId; patch: Partial<SceneObject> }>,
    ) {
      const doc = current(state.history.present);
      const next: SceneDocument = {
        ...doc,
        objects: doc.objects.map((o) =>
          o.id === action.payload.id ? ({ ...o, ...action.payload.patch } as SceneObject) : o,
        ),
      };
      pushHistory(state, next);
    },

    // ── Z-order ───────────────────────────────────────────────────
    bringToFront(state, action: PayloadAction<ObjectId>) {
      pushHistory(state, docToFront(current(state.history.present), action.payload));
    },
    sendToBack(state, action: PayloadAction<ObjectId>) {
      pushHistory(state, docToBack(current(state.history.present), action.payload));
    },
    reorderLayer(state, action: PayloadAction<{ from: number; to: number }>) {
      pushHistory(state, docReorder(current(state.history.present), action.payload.from, action.payload.to));
    },

    // ── Grouping ──────────────────────────────────────────────────
    groupSelected(state) {
      if (state.selectedIds.length < 2) return;
      const { doc, groupId } = groupObjects(current(state.history.present), state.selectedIds);
      pushHistory(state, doc);
      state.selectedIds = [groupId];
    },
    ungroupSelected(state) {
      const [groupId] = state.selectedIds;
      if (!groupId) return;
      const members = current(state.history.present).objects.filter((o) => o.groupId === groupId);
      pushHistory(state, ungroup(current(state.history.present), groupId));
      state.selectedIds = members.map((m) => m.id);
    },

    // ── Live interaction (drag/transform) → single undo entry ─────
    beginInteraction(state) {
      state.interacting = true;
      state.interactionBase = current(state.history.present);
    },
    updateLive(state, action: PayloadAction<Record<ObjectId, Partial<SceneObject>>>) {
      const changes = action.payload;
      for (const obj of state.history.present.objects) {
        const patch = changes[obj.id];
        if (patch) Object.assign(obj, patch);
      }
      state.dirty = true;
    },
    endInteraction(state) {
      if (!state.interacting) return;
      const live = current(state.history.present);
      const base = state.interactionBase ?? live;
      state.history.past.push(base);
      if (state.history.past.length > HISTORY_LIMIT) state.history.past.shift();
      state.history.present = live;
      state.history.future = [];
      state.interacting = false;
      state.interactionBase = null;
      state.dirty = true;
    },

    // ── History ───────────────────────────────────────────────────
    undo(state) {
      state.history = histUndo(current(state.history));
      state.selectedIds = [];
      state.dirty = true;
    },
    redo(state) {
      state.history = histRedo(current(state.history));
      state.selectedIds = [];
      state.dirty = true;
    },

    // ── Selection ─────────────────────────────────────────────────
    setSelection(state, action: PayloadAction<ObjectId[]>) {
      state.selectedIds = action.payload;
    },
    toggleSelection(state, action: PayloadAction<ObjectId>) {
      const id = action.payload;
      state.selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id];
    },
    clearSelection(state) {
      state.selectedIds = [];
    },

    // ── Viewport ──────────────────────────────────────────────────
    setViewport(state, action: PayloadAction<Partial<Viewport>>) {
      state.viewport = { ...state.viewport, ...action.payload };
    },
    resetViewport(state) {
      state.viewport = { scale: 1, x: 0, y: 0 };
    },
    toggleGrid(state) {
      state.grid = !state.grid;
    },
    toggleSnap(state) {
      state.snap = !state.snap;
    },

    markSaved(state) {
      state.dirty = false;
    },

    /**
     * Apply a document received from a remote collaborator. Replaces the
     * present without an undo entry and leaves `dirty` false so it is neither
     * re-broadcast nor autosaved by this client (the editing peer owns saving).
     */
    applyRemoteDocument(state, action: PayloadAction<SceneDocument>) {
      state.history.present = action.payload;
      state.dirty = false;
    },
  },
});

export const editorActions = editorSlice.actions;
export default editorSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────
import type { RootState } from '@/lib/store';

export const selectDocument = (s: RootState) => s.editor.history.present;
export const selectSelectedIds = (s: RootState) => s.editor.selectedIds;
export const selectViewport = (s: RootState) => s.editor.viewport;
export const selectCanUndo = (s: RootState) => histCanUndo(s.editor.history);
export const selectCanRedo = (s: RootState) => histCanRedo(s.editor.history);
export const selectEditorMeta = (s: RootState) => ({
  projectId: s.editor.projectId,
  title: s.editor.title,
  width: s.editor.width,
  height: s.editor.height,
  grid: s.editor.grid,
  snap: s.editor.snap,
  dirty: s.editor.dirty,
});
