'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Check, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  editorActions,
  selectDocument,
  selectEditorMeta,
} from '@/lib/features/editor/editorSlice';
import { getProject, renameProject, saveDocument } from '@/lib/api/projects';
import { emptyDocument, type SceneDocument } from '@/lib/editor/types';
import { EditorToolbar } from './EditorToolbar';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { MediaPanel } from './MediaPanel';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

// Konva touches `window` on import, so the canvas must be client-only.
const EditorCanvas = dynamic(() => import('./EditorCanvas').then((m) => m.EditorCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading canvas…
    </div>
  ),
});

function normalizeDocument(raw: unknown, background = '#ffffff'): SceneDocument {
  const d = (raw ?? {}) as Partial<SceneDocument>;
  return {
    version: 1,
    background: typeof d.background === 'string' ? d.background : background,
    objects: Array.isArray(d.objects) ? d.objects : [],
  };
}

export function EditorShell({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectDocument);
  const meta = useAppSelector(selectEditorMeta);

  const stageWrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [saving, setSaving] = useState(false);
  const [leftTab, setLeftTab] = useState<'layers' | 'uploads'>('layers');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centeredRef = useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id),
    retry: false,
  });

  // Hydrate the editor store once the project loads.
  useEffect(() => {
    if (!data) return;
    dispatch(
      editorActions.loadProject({
        id: data.id,
        title: data.title,
        width: data.width,
        height: data.height,
        document: normalizeDocument(data.document),
      }),
    );
    centeredRef.current = false;
  }, [data, dispatch]);

  // Track container size for a responsive Stage.
  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit + center the artboard the first time we know both doc and size.
  useEffect(() => {
    if (centeredRef.current || !size.w || !meta.width) return;
    const scale = Math.min((size.w - 80) / meta.width, (size.h - 80) / meta.height, 1);
    dispatch(
      editorActions.setViewport({
        scale,
        x: (size.w - meta.width * scale) / 2,
        y: (size.h - meta.height * scale) / 2,
      }),
    );
    centeredRef.current = true;
  }, [size, meta.width, meta.height, dispatch]);

  // Debounced autosave whenever the document is dirty.
  const persist = useCallback(async () => {
    if (!meta.projectId) return;
    setSaving(true);
    try {
      await saveDocument(meta.projectId, doc);
      dispatch(editorActions.markSaved());
    } finally {
      setSaving(false);
    }
  }, [doc, meta.projectId, dispatch]);

  useEffect(() => {
    if (!meta.dirty || !meta.projectId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [meta.dirty, meta.projectId, persist]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch(e.shiftKey ? editorActions.redo() : editorActions.undo());
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        dispatch(editorActions.duplicateSelected());
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        dispatch(e.shiftKey ? editorActions.ungroupSelected() : editorActions.groupSelected());
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        dispatch(editorActions.removeSelected());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const savedLabel = useMemo(() => {
    if (saving) return 'Saving…';
    return meta.dirty ? 'Unsaved changes' : 'All changes saved';
  }, [saving, meta.dirty]);

  if (isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">This design could not be loaded.</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="rounded-md p-2 hover:bg-accent" aria-label="Back">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <input
            className="w-64 rounded-md border-transparent bg-transparent px-2 py-1 text-sm font-medium hover:border-border focus:border-border focus:outline-none"
            defaultValue={meta.title}
            key={meta.title}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title && title !== meta.title && meta.projectId) {
                dispatch(editorActions.setTitle(title));
                void renameProject(meta.projectId, title);
              }
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {savedLabel}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Toolbar */}
      <EditorToolbar />

      {/* Body: layers | canvas | properties */}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r md:flex">
          <div className="flex border-b">
            {(['layers', 'uploads'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={cn(
                  'flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors',
                  leftTab === tab
                    ? 'border-b-2 border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">{leftTab === 'layers' ? <LayersPanel /> : <MediaPanel />}</div>
        </aside>

        <div ref={stageWrapRef} className="relative min-w-0 flex-1 bg-muted">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading design…
            </div>
          ) : (
            size.w > 0 && <EditorCanvas stageWidth={size.w} stageHeight={size.h} />
          )}
        </div>

        <aside className="hidden w-64 shrink-0 border-l lg:block">
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}
