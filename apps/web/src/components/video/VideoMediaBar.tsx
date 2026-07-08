'use client';

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Type, Upload } from 'lucide-react';
import { listAssets, uploadAsset, type Asset } from '@/lib/api/media';
import { useAppDispatch } from '@/lib/hooks';
import { videoActions } from '@/lib/features/video/videoSlice';
import { makeAudioClip, makeImageClip, makeTextClip, makeVideoClip } from '@/lib/video/timeline';
import { Button } from '@/components/ui/button';

/** Probe an audio/video asset's duration in ms (best-effort, browser-side). */
function probeDuration(url: string, kind: 'video' | 'audio'): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = 'metadata';
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration * 1000 : 5000);
    el.onerror = () => resolve(5000);
    el.src = url;
  });
}

export function VideoMediaBar() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({ queryKey: ['assets', 'all'], queryFn: () => listAssets({ page: 1 }) });

  const upload = useMutation({
    mutationFn: (files: File[]) => Promise.all(files.map(uploadAsset)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });

  const addAsset = async (a: Asset) => {
    if (a.type === 'VIDEO') {
      const dur = await probeDuration(a.url, 'video');
      dispatch(videoActions.addClip({ trackId: 'track_video', clip: makeVideoClip(a.url, dur, { name: a.name }) }));
    } else if (a.type === 'AUDIO') {
      const dur = await probeDuration(a.url, 'audio');
      dispatch(videoActions.addClip({ trackId: 'track_audio', clip: makeAudioClip(a.url, dur, { name: a.name }) }));
    } else {
      dispatch(videoActions.addClip({ trackId: 'track_video', clip: makeImageClip(a.url, { name: a.name }) }));
    }
  };

  const assets: Asset[] = data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Media</span>
        <button onClick={() => inputRef.current?.click()} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent">
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          hidden
          onChange={(e) => e.target.files && upload.mutate(Array.from(e.target.files))}
        />
      </div>

      <div className="border-b p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => dispatch(videoActions.addClip({ trackId: 'track_overlay', clip: makeTextClip('Your title') }))}
        >
          <Type className="mr-1 h-4 w-4" /> Add text
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Upload media to add to your timeline.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((a) => (
              <button
                key={a.id}
                onClick={() => addAsset(a)}
                className="overflow-hidden rounded-md border text-left transition-colors hover:border-primary"
                title={`Add ${a.name}`}
              >
                {a.type === 'IMAGE' || a.type === 'GIF' || a.type === 'SVG' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-secondary text-[10px] uppercase text-muted-foreground">
                    {a.type}
                  </div>
                )}
                <span className="block truncate px-1 py-0.5 text-[10px]">{a.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
