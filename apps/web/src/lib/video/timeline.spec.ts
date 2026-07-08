import { describe, expect, it } from 'vitest';
import { emptyVideoDocument } from './types';
import {
  addClip,
  findClip,
  makeImageClip,
  makeVideoClip,
  moveClip,
  removeClip,
  setClipSpeed,
  splitClip,
  timelineDuration,
  trackEnd,
  trimClip,
} from './timeline';

const VIDEO_TRACK = 'track_video';

function docWithTwo() {
  let doc = emptyVideoDocument();
  doc = addClip(doc, VIDEO_TRACK, makeVideoClip('a.mp4', 5000, { id: 'a' }));
  doc = addClip(doc, VIDEO_TRACK, makeVideoClip('b.mp4', 3000, { id: 'b' }));
  return doc;
}

describe('timeline operations', () => {
  it('appends clips end-to-end and computes duration', () => {
    const doc = docWithTwo();
    const track = doc.tracks.find((t) => t.id === VIDEO_TRACK)!;
    expect(track.clips.map((c) => [c.id, c.start])).toEqual([
      ['a', 0],
      ['b', 5000],
    ]);
    expect(trackEnd(track)).toBe(8000);
    expect(timelineDuration(doc)).toBe(8000);
    // input immutability
    expect(emptyVideoDocument().tracks[0]!.clips).toHaveLength(0);
  });

  it('moves a clip and clamps start to >= 0', () => {
    const doc = moveClip(docWithTwo(), 'b', -500);
    expect(findClip(doc, 'b')!.clip.start).toBe(0);
  });

  it('moves a clip across tracks', () => {
    const doc = moveClip(docWithTwo(), 'b', 1000, 'track_overlay');
    expect(findClip(doc, 'b')!.track.id).toBe('track_overlay');
    expect(doc.tracks.find((t) => t.id === VIDEO_TRACK)!.clips.map((c) => c.id)).toEqual(['a']);
  });

  it('trims the end edge, adjusting duration and trimOut', () => {
    const doc = trimClip(docWithTwo(), 'a', 'end', -2000);
    const { clip } = findClip(doc, 'a')!;
    expect(clip.duration).toBe(3000);
    expect(clip.trimOut).toBe(3000);
  });

  it('refuses to trim below the minimum duration', () => {
    const doc = trimClip(docWithTwo(), 'a', 'end', -4990);
    expect(findClip(doc, 'a')!.clip.duration).toBe(5000); // unchanged
  });

  it('splits a clip at an absolute time into two adjacent clips', () => {
    const doc = splitClip(docWithTwo(), 'a', 2000);
    const clips = doc.tracks.find((t) => t.id === VIDEO_TRACK)!.clips;
    // a (0-2000), new (2000-5000), b (5000-8000)
    expect(clips).toHaveLength(3);
    const [left, right] = clips;
    expect(left).toMatchObject({ id: 'a', start: 0, duration: 2000, trimOut: 2000 });
    expect(right).toMatchObject({ start: 2000, duration: 3000, trimIn: 2000 });
  });

  it('ignores a split point outside the clip', () => {
    expect(splitClip(docWithTwo(), 'a', 9000).tracks.find((t) => t.id === VIDEO_TRACK)!.clips).toHaveLength(2);
  });

  it('changing speed rescales duration but preserves the source window', () => {
    const doc = setClipSpeed(docWithTwo(), 'a', 2);
    const { clip } = findClip(doc, 'a')!;
    expect(clip.speed).toBe(2);
    expect(clip.duration).toBe(2500); // 5000 source / 2x
    expect(clip.trimOut - clip.trimIn).toBe(5000); // source window unchanged
  });

  it('removes a clip (others keep their positions — no ripple)', () => {
    const doc = removeClip(docWithTwo(), 'a');
    expect(findClip(doc, 'a')).toBeNull();
    // b stays at start 5000, so the timeline still ends at 8000.
    expect(timelineDuration(doc)).toBe(8000);
  });

  it('image clips default to a fixed duration', () => {
    const doc = addClip(emptyVideoDocument(), VIDEO_TRACK, makeImageClip('x.png', { id: 'img' }));
    expect(findClip(doc, 'img')!.clip.duration).toBe(4000);
  });
});
