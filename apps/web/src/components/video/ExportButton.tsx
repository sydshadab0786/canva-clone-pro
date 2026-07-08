'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Check, AlertCircle } from 'lucide-react';
import { getExportStatus, startExport, type ExportJob } from '@/lib/api/export';
import { Button } from '@/components/ui/button';

/** Kick off an export and poll its progress until done. */
export function ExportButton({ projectId }: { projectId: string }) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const begin = async () => {
    setBusy(true);
    try {
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
      <Button size="sm" variant="outline" className="gap-1" onClick={begin} title={job.error ?? 'Export failed'}>
        <AlertCircle className="h-4 w-4 text-destructive" /> Retry
      </Button>
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
