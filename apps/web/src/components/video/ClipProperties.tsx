'use client';

import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectSelectedClipId, selectVideoDoc, videoActions } from '@/lib/features/video/videoSlice';
import { findClip } from '@/lib/video/timeline';
import type { TransitionKind } from '@/lib/video/types';
import { formatTimecode } from '@/lib/video/format';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function ClipProperties() {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectVideoDoc);
  const selectedId = useAppSelector(selectSelectedClipId);

  const found = selectedId ? findClip(doc, selectedId) : null;
  if (!found) {
    return <div className="p-4 text-center text-xs text-muted-foreground">Select a clip to edit it.</div>;
  }
  const { clip } = found;
  const update = (patch: Parameters<typeof videoActions.updateClip>[0]['patch']) =>
    dispatch(videoActions.updateClip({ clipId: clip.id, patch }));

  return (
    <div className="space-y-4 p-4">
      <div className="text-sm font-semibold capitalize">{clip.kind} clip</div>

      <Row label="Name">
        <Input value={clip.name} onChange={(e) => update({ name: e.target.value })} />
      </Row>
      <Row label="Duration">
        <span className="font-mono text-xs">{formatTimecode(clip.duration)}</span>
      </Row>

      <Row label="Speed">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={clip.speed}
            onChange={(e) => dispatch(videoActions.setClipSpeed({ clipId: clip.id, speed: Number(e.target.value) }))}
          />
          <span className="w-8 text-xs tabular-nums">{clip.speed}x</span>
        </div>
      </Row>

      {(clip.kind === 'video' || clip.kind === 'audio') && (
        <Row label="Volume">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={clip.volume}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
        </Row>
      )}

      <Row label="Transition">
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={clip.transitionIn}
          onChange={(e) => update({ transitionIn: e.target.value as TransitionKind })}
        >
          <option value="none">None</option>
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
          <option value="wipe">Wipe</option>
        </select>
      </Row>

      {clip.kind === 'text' && (
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs text-muted-foreground">Text</Label>
          <textarea
            className="w-full rounded-md border bg-background p-2 text-sm"
            rows={2}
            value={clip.text ?? ''}
            onChange={(e) => update({ text: e.target.value })}
          />
          <Row label="Colour">
            <input type="color" value={clip.fill ?? '#ffffff'} onChange={(e) => update({ fill: e.target.value })} className="h-8 w-full" />
          </Row>
          <Row label="Font size">
            <Input type="number" value={clip.fontSize ?? 64} onChange={(e) => update({ fontSize: Number(e.target.value) })} />
          </Row>
        </div>
      )}
    </div>
  );
}
