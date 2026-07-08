'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Film } from 'lucide-react';
import { useAppSelector } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { createProject, listProjects, type ProjectSummary } from '@/lib/api/projects';
import { emptyDocument, type SceneDocument } from '@/lib/editor/types';
import { emptyVideoDocument } from '@/lib/video/types';

// Design-type quick-start tiles mirroring the Canva create flow.
const CREATE_TILES = [
  { label: 'Instagram Post', type: 'INSTAGRAM_POST', ratio: '1:1', w: 1080, h: 1080 },
  { label: 'Presentation', type: 'PRESENTATION', ratio: '16:9', w: 1920, h: 1080 },
  { label: 'Poster', type: 'POSTER', ratio: '2:3', w: 1080, h: 1620 },
  { label: 'Logo', type: 'LOGO', ratio: '1:1', w: 500, h: 500 },
  { label: 'Resume', type: 'RESUME', ratio: 'A4', w: 794, h: 1123 },
  { label: 'YouTube Thumbnail', type: 'YOUTUBE_THUMBNAIL', ratio: '16:9', w: 1280, h: 720 },
];

export default function DashboardHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAppSelector((s) => s.auth.user);
  const [creatingLabel, setCreatingLabel] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'recent'],
    queryFn: () => listProjects({ page: 1 }),
  });

  const create = useMutation({
    mutationFn: (tile: { label: string; type: string; w: number; h: number }) =>
      createProject({
        title: tile.label,
        type: tile.type,
        width: tile.w,
        height: tile.h,
        document: emptyDocument(),
      }),
    onMutate: (tile) => setCreatingLabel(tile.label),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/design/${project.id}`);
    },
    onSettled: () => setCreatingLabel(null),
  });

  const createVideo = useMutation({
    mutationFn: () =>
      createProject({
        title: 'Untitled video',
        type: 'VIDEO',
        width: 1920,
        height: 1080,
        document: emptyVideoDocument() as unknown as SceneDocument,
      }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/video/${project.id}`);
    },
  });

  const recents: ProjectSummary[] = data?.items ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome{user ? `, ${user.displayName.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-sm text-muted-foreground">What will you design today?</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={createVideo.isPending}
            onClick={() => createVideo.mutate()}
          >
            {createVideo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            Create a video
          </Button>
          <Button
            className="gap-2"
            disabled={create.isPending}
            onClick={() =>
              create.mutate({ label: 'Untitled design', type: 'CUSTOM', w: 1080, h: 1080 })
            }
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create a design
          </Button>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Start from a blank canvas</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CREATE_TILES.map((tile) => (
            <button
              key={tile.label}
              disabled={create.isPending}
              onClick={() => create.mutate(tile)}
              className="group flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
            >
              <div className="flex h-16 w-full items-center justify-center rounded bg-secondary text-xs text-muted-foreground">
                {creatingLabel === tile.label ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  tile.ratio
                )}
              </div>
              <span className="text-xs font-medium">{tile.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recent designs</h2>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : recents.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
            You haven&apos;t created any designs yet. Click{' '}
            <span className="font-medium text-foreground">Create a design</span> to get started.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {recents.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`${p.type === 'VIDEO' ? '/video' : '/design'}/${p.id}`)}
                className="group overflow-hidden rounded-lg border text-left transition-colors hover:border-primary"
              >
                <div className="flex aspect-video items-center justify-center bg-secondary">
                  {p.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnailUrl} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{p.width}×{p.height}</span>
                  )}
                </div>
                <div className="truncate px-3 py-2 text-sm font-medium">{p.title}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
