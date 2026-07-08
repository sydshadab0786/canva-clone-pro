/**
 * Snapshot-based undo/redo history.
 *
 * The editor deals in small documents (a design is hundreds of objects, not
 * millions), so full-document snapshots are simpler and more robust than a
 * command/inverse-command log — and they can't drift out of sync with state.
 * A bounded stack caps memory.
 */
import type { SceneDocument } from './types';

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  limit: number;
}

export function createHistory<T>(present: T, limit = 100): History<T> {
  return { past: [], present, future: [], limit };
}

/** Commit a new present, pushing the old one onto the undo stack. */
export function commit<T>(history: History<T>, next: T): History<T> {
  const past = [...history.past, history.present];
  // Enforce the bound by dropping the oldest entries.
  const trimmed = past.length > history.limit ? past.slice(past.length - history.limit) : past;
  return { ...history, past: trimmed, present: next, future: [] };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1] as T;
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;
  const next = history.future[0] as T;
  return {
    ...history,
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

/** Replace the present without creating an undo entry (e.g. loading a doc). */
export function reset<T>(history: History<T>, present: T): History<T> {
  return createHistory(present, history.limit);
}

export type DocumentHistory = History<SceneDocument>;
