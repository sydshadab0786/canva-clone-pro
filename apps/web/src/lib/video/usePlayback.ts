'use client';

import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectPlaying, selectVideoDuration, videoActions } from '@/lib/features/video/videoSlice';

/**
 * Drives the playhead with requestAnimationFrame while playing. Advancing in
 * the animation loop (not a fixed interval) keeps playback smooth and in sync
 * with real elapsed time regardless of frame rate. Stops at the end.
 */
export function usePlayback() {
  const dispatch = useAppDispatch();
  const playing = useAppSelector(selectPlaying);
  const duration = useAppSelector(selectVideoDuration);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  // Read the current playhead lazily so the effect doesn't restart each frame.
  const playheadRef = useRef(0);
  playheadRef.current = useAppSelector((s) => s.video.playhead);

  useEffect(() => {
    if (!playing) {
      lastTsRef.current = null;
      return;
    }
    const step = (ts: number) => {
      if (lastTsRef.current != null) {
        const delta = ts - lastTsRef.current;
        const next = playheadRef.current + delta;
        if (next >= duration) {
          dispatch(videoActions.setPlayhead(duration));
          dispatch(videoActions.pause());
          return;
        }
        dispatch(videoActions.setPlayhead(next));
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, duration, dispatch]);
}
