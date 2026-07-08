'use client';

import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2 } from 'lucide-react';
import { listAssets, uploadAsset, type Asset } from '@/lib/api/media';
import { useAppDispatch } from '@/lib/hooks';
import { editorActions } from '@/lib/features/editor/editorSlice';
import { makeImage } from '@/lib/editor/document';

/** In-editor media library: upload and drop images onto the canvas. */
export function MediaPanel() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assets', 'image'],
    queryFn: () => listAssets({ type: 'IMAGE', page: 1 }),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => Promise.all(files.map(uploadAsset)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });

  const insert = (asset: Asset) => {
    // Scale the placed image to fit a sensible default box.
    const w = asset.width ?? 320;
    const h = asset.height ?? 240;
    const max = 400;
    const ratio = Math.min(max / w, max / h, 1);
    dispatch(
      editorActions.addObject(
        makeImage(asset.url, { x: 100, y: 100, width: w * ratio, height: h * ratio, name: asset.name }),
      ),
    );
  };

  const assets: Asset[] = data?.items ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Uploads</span>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent"
        >
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          hidden
          onChange={(e) => e.target.files && upload.mutate(Array.from(e.target.files))}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            Upload images to reuse them across designs.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((a) => (
              <button
                key={a.id}
                onClick={() => insert(a)}
                className="overflow-hidden rounded-md border transition-colors hover:border-primary"
                title={`Insert ${a.name}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
