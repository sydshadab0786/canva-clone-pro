'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Check, Loader2 } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectVideoDoc, selectVideoMeta, videoActions } from '@/lib/features/video/videoSlice';
import { getProject, renameProject, saveDocument } from '@/lib/api/projects';
import { emptyVideoDocument, type VideoDocument } from '@/lib/video/types';
import type { SceneDocument } from '@/lib/editor/types';
import { usePlayback } from '@/lib/video/usePlayback';
import { VideoTransport } from './VideoTransport';
import { VideoPreview } from './VideoPreview';
import { Timeline } from './Timeline';
import { ClipProperties } from './ClipProperties';
import { VideoMediaBar } from './VideoMediaBar';
import { ExportButton } from './ExportButton';
import { ThemeToggle } from '@/components/theme-toggle';

function normalizeVideo(raw: unknown): VideoDocument {
  const d = raw as Partial<VideoDocument> | undefined;
  if (d && Array.isArray(d.tracks) && d.tracks.length > 0) return d as VideoDocument;
  return emptyVideoDocument();
}

export function VideoShell({ id }: { id: string }) {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectVideoDoc);
  const meta = useAppSelector(selectVideoMeta);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePlayback();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id),
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    dispatch(
      videoActions.loadVideo({ id: data.id, title: data.title, document: normalizeVideo(data.document) }),
    );
  }, [data, dispatch]);

  // Debounced autosave (the video timeline is stored in Project.document).
  const persist = useCallback(async () => {
    if (!meta.projectId) return;
    setSaving(true);
    try {
      await saveDocument(meta.projectId, doc as unknown as SceneDocument);
      dispatch(videoActions.markSaved());
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

  // Keyboard: space = play/pause, delete = remove clip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        dispatch(videoActions.play());
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        dispatch(videoActions.removeSelected());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  const savedLabel = useMemo(() => (saving ? 'Saving…' : meta.dirty ? 'Unsaved changes' : 'All changes saved'), [saving, meta.dirty]);

  if (isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">This video could not be loaded.</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
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
                dispatch(videoActions.setTitle(title));
                void renameProject(meta.projectId, title);
              }
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {savedLabel}
          </span>
          {meta.projectId && <ExportButton projectId={meta.projectId} />}
          <ThemeToggle />
        </div>
      </header>

      <VideoTransport />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r md:block">
          <VideoMediaBar />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 bg-black">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-white/60">Loading video…</div>
            ) : (
              <VideoPreview />
            )}
          </div>
          <div className="h-72 shrink-0 border-t bg-card">
            <Timeline />
          </div>
        </div>

        <aside className="hidden w-64 shrink-0 border-l lg:block">
          <ClipProperties />
        </aside>
      </div>
    </div>
  );
}
