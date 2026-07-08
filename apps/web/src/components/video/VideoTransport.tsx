'use client';

import { Play, Pause, SkipBack, Scissors, Trash2, Undo2, Redo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  selectPlayhead,
  selectPlaying,
  selectSelectedClipId,
  selectVideoCanRedo,
  selectVideoCanUndo,
  selectVideoDuration,
  videoActions,
} from '@/lib/features/video/videoSlice';
import { formatTimecode } from '@/lib/video/format';
import { Button } from '@/components/ui/button';

export function VideoTransport() {
  const dispatch = useAppDispatch();
  const playing = useAppSelector(selectPlaying);
  const playhead = useAppSelector(selectPlayhead);
  const duration = useAppSelector(selectVideoDuration);
  const selected = useAppSelector(selectSelectedClipId);
  const canUndo = useAppSelector(selectVideoCanUndo);
  const canRedo = useAppSelector(selectVideoCanRedo);
  const pps = useAppSelector((s) => s.video.pxPerSecond);

  return (
    <div className="flex items-center gap-1 border-b bg-card px-3 py-2">
      <Button variant="ghost" size="icon" aria-label="Rewind" onClick={() => dispatch(videoActions.setPlayhead(0))}>
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => dispatch(playing ? videoActions.pause() : videoActions.play())}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <span className="mx-2 font-mono text-xs tabular-nums text-muted-foreground">
        {formatTimecode(playhead)} / {formatTimecode(duration)}
      </span>

      <span className="mx-1 h-6 w-px bg-border" />

      <Button variant="ghost" size="icon" aria-label="Undo" disabled={!canUndo} onClick={() => dispatch(videoActions.undo())}>
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Redo" disabled={!canRedo} onClick={() => dispatch(videoActions.redo())}>
        <Redo2 className="h-4 w-4" />
      </Button>

      <span className="mx-1 h-6 w-px bg-border" />

      <Button variant="ghost" size="sm" disabled={!selected} onClick={() => dispatch(videoActions.splitAtPlayhead())}>
        <Scissors className="mr-1 h-4 w-4" /> Split
      </Button>
      <Button variant="ghost" size="icon" aria-label="Delete clip" disabled={!selected} onClick={() => dispatch(videoActions.removeSelected())}>
        <Trash2 className="h-4 w-4" />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => dispatch(videoActions.setZoom(pps - 20))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => dispatch(videoActions.setZoom(pps + 20))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
