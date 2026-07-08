'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { uploadAsset, listAssets, deleteAsset, type Asset } from '@/lib/api/media';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function UploadsPage() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => listAssets({ page: 1 }),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => Promise.all(files.map(uploadAsset)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAsset(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assets'] }),
  });

  const onFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      upload.mutate(Array.from(list));
    },
    [upload],
  );

  const assets: Asset[] = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Uploads</h1>
        <p className="text-sm text-muted-foreground">Your images, videos and other media.</p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          dragOver ? 'border-primary bg-accent' : 'hover:border-primary/60',
        )}
      >
        {upload.isPending ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {upload.isPending ? 'Uploading…' : 'Drag & drop files, or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">Images, video, audio, PDF — up to 50 MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,application/pdf"
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {upload.isError && (
        <p className="text-sm text-destructive">Upload failed. Check the file type and size.</p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No uploads yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {assets.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-lg border">
              <div className="flex aspect-square items-center justify-center bg-secondary">
                {a.type === 'IMAGE' || a.type === 'SVG' || a.type === 'GIF' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="truncate px-2 py-1 text-xs">{a.name}</div>
              <button
                onClick={() => remove.mutate(a.id)}
                className="absolute right-1 top-1 rounded-md bg-background/80 p-1 opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
