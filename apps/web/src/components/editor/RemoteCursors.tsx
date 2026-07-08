'use client';

import { MousePointer2 } from 'lucide-react';
import { useAppSelector } from '@/lib/hooks';
import { selectViewport } from '@/lib/features/editor/editorSlice';
import type { RemoteCursor } from '@/lib/collab/useCollab';

/**
 * Overlay of collaborators' cursors. Positions arrive in artboard coordinates
 * and are projected into this client's screen space using the local viewport,
 * so every cursor points at the same design point regardless of each person's
 * pan/zoom.
 */
export function RemoteCursors({ cursors }: { cursors: Record<string, RemoteCursor> }) {
  const viewport = useAppSelector(selectViewport);
  const list = Object.values(cursors);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {list.map((c) => {
        const left = c.x * viewport.scale + viewport.x;
        const top = c.y * viewport.scale + viewport.y;
        return (
          <div
            key={c.userId}
            className="absolute flex items-center gap-1 transition-transform duration-75"
            style={{ transform: `translate(${left}px, ${top}px)` }}
          >
            <MousePointer2 className="h-4 w-4" style={{ color: c.color }} fill={c.color} />
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
              style={{ backgroundColor: c.color }}
            >
              {c.displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
