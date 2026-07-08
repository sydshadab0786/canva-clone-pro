'use client';

import { useRef } from 'react';
import {
  Type,
  Square,
  Circle,
  Minus,
  ImageIcon,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  Group as GroupIcon,
  Ungroup,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3x3,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  editorActions,
  selectCanRedo,
  selectCanUndo,
  selectSelectedIds,
} from '@/lib/features/editor/editorSlice';
import { makeEllipse, makeLine, makeRect, makeText, makeImage } from '@/lib/editor/document';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Divider() {
  return <span className="mx-1 h-6 w-px bg-border" />;
}

export function EditorToolbar() {
  const dispatch = useAppDispatch();
  const canUndo = useAppSelector(selectCanUndo);
  const canRedo = useAppSelector(selectCanRedo);
  const selectedIds = useAppSelector(selectSelectedIds);
  const grid = useAppSelector((s) => s.editor.grid);
  const scale = useAppSelector((s) => s.editor.viewport.scale);
  const fileRef = useRef<HTMLInputElement>(null);

  // Drop new objects near the artboard's top-left with a small offset.
  const spawn = { x: 80, y: 80 };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const ratio = Math.min(max / img.width, max / img.height, 1);
        dispatch(
          editorActions.addObject(
            makeImage(src, {
              ...spawn,
              width: img.width * ratio,
              height: img.height * ratio,
            }),
          ),
        );
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const zoomStep = (dir: 1 | -1) => {
    const next = dir > 0 ? scale * 1.2 : scale / 1.2;
    dispatch(editorActions.setViewport({ scale: Math.max(0.05, Math.min(8, next)) }));
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-card px-3 py-2">
      <Button variant="ghost" size="sm" onClick={() => dispatch(editorActions.addObject(makeText(spawn)))}>
        <Type className="mr-1 h-4 w-4" /> Text
      </Button>
      <Button variant="ghost" size="icon" aria-label="Rectangle" onClick={() => dispatch(editorActions.addObject(makeRect(spawn)))}>
        <Square className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Ellipse" onClick={() => dispatch(editorActions.addObject(makeEllipse(spawn)))}>
        <Circle className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Line" onClick={() => dispatch(editorActions.addObject(makeLine(spawn)))}>
        <Minus className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Image" onClick={() => fileRef.current?.click()}>
        <ImageIcon className="h-4 w-4" />
      </Button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />

      <Divider />

      <Button variant="ghost" size="icon" aria-label="Undo" disabled={!canUndo} onClick={() => dispatch(editorActions.undo())}>
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Redo" disabled={!canRedo} onClick={() => dispatch(editorActions.redo())}>
        <Redo2 className="h-4 w-4" />
      </Button>

      <Divider />

      <Button variant="ghost" size="icon" aria-label="Duplicate" disabled={!selectedIds.length} onClick={() => dispatch(editorActions.duplicateSelected())}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Delete" disabled={!selectedIds.length} onClick={() => dispatch(editorActions.removeSelected())}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Group" disabled={selectedIds.length < 2} onClick={() => dispatch(editorActions.groupSelected())}>
        <GroupIcon className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Ungroup" disabled={!selectedIds.length} onClick={() => dispatch(editorActions.ungroupSelected())}>
        <Ungroup className="h-4 w-4" />
      </Button>

      <Divider />

      <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => zoomStep(-1)}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(scale * 100)}%
      </span>
      <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => zoomStep(1)}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Reset view" onClick={() => dispatch(editorActions.resetViewport())}>
        <Maximize className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle grid"
        className={cn(grid && 'text-primary')}
        onClick={() => dispatch(editorActions.toggleGrid())}
      >
        <Grid3x3 className="h-4 w-4" />
      </Button>
    </div>
  );
}
