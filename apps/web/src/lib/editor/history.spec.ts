import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commit, createHistory, redo, reset, undo } from './history';

describe('history stack', () => {
  it('starts empty with no undo/redo available', () => {
    const h = createHistory(0);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe(0);
  });

  it('commits new states and enables undo', () => {
    let h = createHistory(0);
    h = commit(h, 1);
    h = commit(h, 2);
    expect(h.present).toBe(2);
    expect(canUndo(h)).toBe(true);
    expect(h.past).toEqual([0, 1]);
  });

  it('undo/redo walks the stack correctly', () => {
    let h = createHistory('a');
    h = commit(h, 'b');
    h = commit(h, 'c');
    h = undo(h);
    expect(h.present).toBe('b');
    expect(canRedo(h)).toBe(true);
    h = undo(h);
    expect(h.present).toBe('a');
    h = redo(h);
    expect(h.present).toBe('b');
  });

  it('a fresh commit clears the redo future', () => {
    let h = createHistory(0);
    h = commit(h, 1);
    h = undo(h); // present 0, future [1]
    expect(canRedo(h)).toBe(true);
    h = commit(h, 9); // branching commit
    expect(canRedo(h)).toBe(false);
    expect(h.present).toBe(9);
  });

  it('respects the bounded limit by dropping oldest entries', () => {
    let h = createHistory(0, 3);
    for (let i = 1; i <= 10; i += 1) h = commit(h, i);
    // present is 10; past holds at most `limit` entries
    expect(h.present).toBe(10);
    expect(h.past).toHaveLength(3);
    expect(h.past).toEqual([7, 8, 9]);
  });

  it('reset replaces present and clears history', () => {
    let h = createHistory(0);
    h = commit(h, 1);
    h = reset(h, 42);
    expect(h.present).toBe(42);
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('undo/redo are no-ops at the ends', () => {
    let h = createHistory(0);
    expect(undo(h).present).toBe(0);
    h = commit(h, 1);
    expect(redo(h).present).toBe(1); // nothing to redo
  });
});
