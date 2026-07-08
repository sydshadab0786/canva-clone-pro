'use client';

import { Plus } from 'lucide-react';
import { useAppSelector } from '@/lib/hooks';
import { Button } from '@/components/ui/button';

// Design-type quick-start tiles mirroring the Canva create flow.
const CREATE_TILES = [
  { label: 'Instagram Post', ratio: '1:1', w: 1080, h: 1080 },
  { label: 'Presentation', ratio: '16:9', w: 1920, h: 1080 },
  { label: 'Poster', ratio: '2:3', w: 1080, h: 1620 },
  { label: 'Logo', ratio: '1:1', w: 500, h: 500 },
  { label: 'Resume', ratio: 'A4', w: 794, h: 1123 },
  { label: 'YouTube Thumbnail', ratio: '16:9', w: 1280, h: 720 },
];

export default function DashboardHome() {
  const user = useAppSelector((s) => s.auth.user);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome{user ? `, ${user.displayName.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-sm text-muted-foreground">What will you design today?</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Create a design
        </Button>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Start from a blank canvas</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CREATE_TILES.map((tile) => (
            <button
              key={tile.label}
              className="group flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="flex h-16 w-full items-center justify-center rounded bg-secondary text-xs text-muted-foreground">
                {tile.ratio}
              </div>
              <span className="text-xs font-medium">{tile.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recent designs</h2>
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          You haven&apos;t created any designs yet. Click{' '}
          <span className="font-medium text-foreground">Create a design</span> to get started.
        </div>
      </section>
    </div>
  );
}
