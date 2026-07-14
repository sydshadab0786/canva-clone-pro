'use client';

import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Square,
  Circle,
  Minus,
  ImageIcon,
  Boxes,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { editorActions, selectDocument, selectSelectedIds } from '@/lib/features/editor/editorSlice';
import type { SceneObject, SceneObjectType } from '@/lib/editor/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ICONS: Record<SceneObjectType, typeof Type> = {
  text: Type,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  image: ImageIcon,
  group: Boxes,
};

/**
 * Label a layer the way a designer expects: text layers are identified by their
 * content (a panel full of layers all called "Text" is unusable), everything
 * else falls back to its object name.
 */
function layerLabel(obj: SceneObject): string {
  if (obj.type === 'text') {
    const content = obj.text?.replace(/\s+/g, ' ').trim();
    if (content) return content.slice(0, 28);
  }
  return obj.name;
}

export function LayersPanel() {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectDocument);
  const selectedIds = useAppSelector(selectSelectedIds);

  // Layers are shown top-most first (reverse of z-order array).
  const layers = [...doc.objects].reverse();

  const toggle = (obj: SceneObject, key: 'visible' | 'locked') =>
    dispatch(editorActions.updateObjectCommit({ id: obj.id, patch: { [key]: !obj[key] } }));

  const move = (index: number, dir: 1 | -1) => {
    // index is into the reversed list; convert to z-order indices.
    const from = doc.objects.length - 1 - index;
    const to = from + dir;
    if (to < 0 || to >= doc.objects.length) return;
    dispatch(editorActions.reorderLayer({ from, to }));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">Layers</div>
      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">No layers yet.</p>
        )}
        {layers.map((obj, i) => {
          const Icon = ICONS[obj.type];
          const active = selectedIds.includes(obj.id);
          return (
            /**
             * The row controls are absolutely positioned rather than inline:
             * laid out inline they consumed ~half the row, so a click near the
             * middle landed on the reorder chevrons (which stopPropagation) and
             * silently reordered the layer instead of selecting it.
             * Now the name owns the full row and clicking anywhere selects.
             */
            <div
              key={obj.id}
              className={cn(
                'group relative flex items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-sm',
                active ? 'bg-secondary' : 'hover:bg-accent',
              )}
              onClick={() => dispatch(editorActions.setSelection([obj.id]))}
              role="button"
              tabIndex={0}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{layerLabel(obj)}</span>

              <div
                className={cn(
                  'absolute right-1 top-1/2 flex -translate-y-1/2 items-center rounded px-0.5 opacity-0 transition-opacity group-hover:opacity-100',
                  active ? 'bg-secondary' : 'bg-accent',
                )}
              >
                <button
                  className="rounded p-1 hover:bg-background"
                  aria-label="Move up"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(i, 1);
                  }}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1 hover:bg-background"
                  aria-label="Move down"
                  onClick={(e) => {
                    e.stopPropagation();
                    move(i, -1);
                  }}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  className="rounded p-1 hover:bg-background"
                  aria-label={obj.locked ? 'Unlock' : 'Lock'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(obj, 'locked');
                  }}
                >
                  {obj.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5 opacity-50" />}
                </button>
                <button
                  className="rounded p-1 hover:bg-background"
                  aria-label={obj.visible ? 'Hide' : 'Show'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(obj, 'visible');
                  }}
                >
                  {obj.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-50" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
