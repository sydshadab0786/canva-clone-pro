'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Check, AlertCircle } from 'lucide-react';
import { getExportStatus, startExport, type ExportJob } from '@/lib/api/export';
import { Button } from '@/components/ui/button';

/**
 * Kick off an export and poll its progress until done.
 *
 * `onBeforeExport` must flush any pending autosave: the renderer reads the
 * document from the server, so exporting without flushing would silently
 * render a stale (or empty) timeline.
 */
export function ExportButton({
  projectId,
  onBeforeExport,
}: {
  projectId: string;
  onBeforeExport?: () => Promise<void>;
}) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const begin = async () => {
    setBusy(true);
    try {
      await onBeforeExport?.();
      const started = await startExport(projectId);
      setJob(started);
      pollRef.current = setInterval(async () => {
        const next = await getExportStatus(started.id);
        setJob(next);
        if (next.status === 'completed' || next.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setBusy(false);
        }
      }, 500);
    } catch {
      setBusy(false);
    }
  };

  if (job?.status === 'completed' && job.resultUrl) {
    return (
      <a href={job.resultUrl} target="_blank" rel="noreferrer">
        <Button size="sm" variant="outline" className="gap-1">
          <Check className="h-4 w-4 text-green-600" /> Download {job.format.toUpperCase()}
        </Button>
      </a>
    );
  }

  if (job?.status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <span className="max-w-[220px] truncate text-xs text-destructive" title={job.error ?? undefined}>
          {job.error ?? 'Export failed'}
        </span>
        <Button size="sm" variant="outline" className="gap-1" onClick={begin}>
          <AlertCircle className="h-4 w-4 text-destructive" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" className="gap-1" disabled={busy} onClick={begin}>
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Rendering {job?.progress ?? 0}%
        </>
      ) : (
        <>
          <Download className="h-4 w-4" /> Export
        </>
      )}
    </Button>
  );
}
