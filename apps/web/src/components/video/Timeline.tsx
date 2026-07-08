'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  selectPlayhead,
  selectSelectedClipId,
  selectVideoDoc,
  selectVideoDuration,
  videoActions,
} from '@/lib/features/video/videoSlice';
import type { Clip } from '@/lib/video/types';
import { cn } from '@/lib/utils';

const LABEL_W = 96;
const ROW_H = 56;
const CLIP_COLORS: Record<string, string> = {
  video: '#6366f1',
  image: '#0ea5e9',
  text: '#f59e0b',
  audio: '#10b981',
};

type Drag =
  | { mode: 'move'; clipId: string; startX: number; origStart: number }
  | { mode: 'trim-start' | 'trim-end'; clipId: string; startX: number }
  | { mode: 'seek' }
  | null;

export function Timeline() {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectVideoDoc);
  const playhead = useAppSelector(selectPlayhead);
  const duration = useAppSelector(selectVideoDuration);
  const selected = useAppSelector(selectSelectedClipId);
  const pps = useAppSelector((s) => s.video.pxPerSecond);

  const laneRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [preview, setPreview] = useState<{ clipId: string; start?: number; trimDelta?: number; edge?: 'start' | 'end' } | null>(null);

  const pxOf = (ms: number) => (ms / 1000) * pps;
  const msOf = (px: number) => (px / pps) * 1000;

  // The full timeline width (min 30s of runway so there's room to drop clips).
  const totalMs = Math.max(duration + 5000, 30000);

  // ── Global pointer handling during a drag ─────────────────────────
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      if (drag.mode === 'seek') {
        const rect = laneRef.current?.getBoundingClientRect();
        if (rect) dispatch(videoActions.setPlayhead(msOf(e.clientX - rect.left - LABEL_W)));
        return;
      }
      if (drag.mode === 'move') {
        const deltaMs = msOf(e.clientX - drag.startX);
        setPreview({ clipId: drag.clipId, start: Math.max(0, drag.origStart + deltaMs) });
      } else {
        const deltaMs = msOf(e.clientX - drag.startX);
        setPreview({ clipId: drag.clipId, trimDelta: deltaMs, edge: drag.mode === 'trim-start' ? 'start' : 'end' });
      }
    };
    const onUp = () => {
      if (preview) {
        if (preview.start != null) dispatch(videoActions.moveClip({ clipId: preview.clipId, start: preview.start }));
        else if (preview.trimDelta != null && preview.edge)
          dispatch(videoActions.trimClip({ clipId: preview.clipId, edge: preview.edge, deltaMs: preview.trimDelta }));
      }
      setDrag(null);
      setPreview(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, preview, dispatch, pps]);

  const renderClip = (clip: Clip) => {
    let start = clip.start;
    let duration2 = clip.duration;
    if (preview?.clipId === clip.id) {
      if (preview.start != null) start = preview.start;
      if (preview.trimDelta != null && preview.edge === 'start') {
        start = clip.start + preview.trimDelta;
        duration2 = clip.duration - preview.trimDelta;
      }
      if (preview.trimDelta != null && preview.edge === 'end') duration2 = clip.duration + preview.trimDelta;
    }
    const isSel = selected === clip.id;
    return (
      <div
        key={clip.id}
        className={cn(
          'group absolute top-1 flex h-[calc(100%-8px)] items-center overflow-hidden rounded-md text-[11px] text-white',
          isSel ? 'ring-2 ring-white' : '',
        )}
        style={{ left: pxOf(start), width: Math.max(6, pxOf(duration2)), background: CLIP_COLORS[clip.kind] ?? '#64748b' }}
        onPointerDown={(e) => {
          e.stopPropagation();
          dispatch(videoActions.selectClip(clip.id));
          setDrag({ mode: 'move', clipId: clip.id, startX: e.clientX, origStart: clip.start });
        }}
      >
        {/* trim handles */}
        <span
          className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/30 opacity-0 group-hover:opacity-100"
          onPointerDown={(e) => {
            e.stopPropagation();
            setDrag({ mode: 'trim-start', clipId: clip.id, startX: e.clientX });
          }}
        />
        <span className="truncate px-2">{clip.name}</span>
        <span
          className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/30 opacity-0 group-hover:opacity-100"
          onPointerDown={(e) => {
            e.stopPropagation();
            setDrag({ mode: 'trim-end', clipId: clip.id, startX: e.clientX });
          }}
        />
      </div>
    );
  };

  // Ruler ticks every second.
  const ticks: number[] = [];
  for (let ms = 0; ms <= totalMs; ms += 1000) ticks.push(ms);

  return (
    <div className="flex flex-col overflow-x-auto">
      {/* Ruler */}
      <div className="relative flex h-6 select-none border-b" style={{ minWidth: LABEL_W + pxOf(totalMs) }}>
        <div className="shrink-0 border-r bg-card" style={{ width: LABEL_W }} />
        <div
          ref={laneRef}
          className="relative flex-1 cursor-text"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            dispatch(videoActions.setPlayhead(msOf(e.clientX - rect.left)));
            setDrag({ mode: 'seek' });
          }}
        >
          {ticks.map((ms) => (
            <span key={ms} className="absolute top-0 text-[9px] text-muted-foreground" style={{ left: pxOf(ms) }}>
              <span className="absolute h-2 border-l border-border" />
              <span className="ml-1">{ms / 1000}s</span>
            </span>
          ))}
        </div>
      </div>

      {/* Tracks */}
      <div className="relative" style={{ minWidth: LABEL_W + pxOf(totalMs) }}>
        {doc.tracks.map((track) => (
          <div key={track.id} className="flex border-b" style={{ height: ROW_H }}>
            <div className="flex shrink-0 items-center gap-1 border-r bg-card px-2 text-xs font-medium" style={{ width: LABEL_W }}>
              {track.name}
            </div>
            <div
              className="relative flex-1"
              onPointerDown={() => dispatch(videoActions.selectClip(null))}
            >
              {track.clips.map(renderClip)}
            </div>
          </div>
        ))}

        {/* Playhead */}
        <div
          className="pointer-events-none absolute top-0 z-10 w-px bg-red-500"
          style={{ left: LABEL_W + pxOf(playhead), height: doc.tracks.length * ROW_H }}
        >
          <span className="absolute -left-1.5 -top-0 h-3 w-3 rounded-full bg-red-500" />
        </div>
      </div>
    </div>
  );
}
