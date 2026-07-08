'use client';

import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { editorActions, selectDocument, selectSelectedIds } from '@/lib/features/editor/editorSlice';
import type { SceneObject } from '@/lib/editor/types';
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

export function PropertiesPanel() {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectDocument);
  const selectedIds = useAppSelector(selectSelectedIds);

  if (selectedIds.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Select an object to edit its properties.
      </div>
    );
  }
  if (selectedIds.length > 1) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        {selectedIds.length} objects selected.
      </div>
    );
  }

  const obj = doc.objects.find((o) => o.id === selectedIds[0]);
  if (!obj) return null;

  const patch = (p: Partial<SceneObject>) =>
    dispatch(editorActions.updateObjectCommit({ id: obj.id, patch: p }));

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="text-sm font-semibold capitalize">{obj.type}</div>

      <div className="space-y-2">
        <Row label="X">
          <Input type="number" value={Math.round(obj.x)} onChange={(e) => patch({ x: num(e.target.value) })} />
        </Row>
        <Row label="Y">
          <Input type="number" value={Math.round(obj.y)} onChange={(e) => patch({ y: num(e.target.value) })} />
        </Row>
        <Row label="W">
          <Input type="number" value={Math.round(obj.width)} onChange={(e) => patch({ width: num(e.target.value) })} />
        </Row>
        <Row label="H">
          <Input type="number" value={Math.round(obj.height)} onChange={(e) => patch({ height: num(e.target.value) })} />
        </Row>
        <Row label="Rotation">
          <Input type="number" value={Math.round(obj.rotation)} onChange={(e) => patch({ rotation: num(e.target.value) })} />
        </Row>
        <Row label="Opacity">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={obj.opacity}
            onChange={(e) => patch({ opacity: num(e.target.value) })}
          />
        </Row>
      </div>

      {(obj.type === 'rect' || obj.type === 'ellipse') && (
        <div className="space-y-2">
          <Row label="Fill">
            <input type="color" value={obj.fill} onChange={(e) => patch({ fill: e.target.value })} className="h-8 w-full" />
          </Row>
        </div>
      )}

      {obj.type === 'line' && (
        <Row label="Stroke">
          <input type="color" value={obj.stroke} onChange={(e) => patch({ stroke: e.target.value })} className="h-8 w-full" />
        </Row>
      )}

      {obj.type === 'text' && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Text</Label>
          <textarea
            className="w-full rounded-md border bg-background p-2 text-sm"
            rows={3}
            value={obj.text}
            onChange={(e) => patch({ text: e.target.value })}
          />
          <Row label="Font size">
            <Input type="number" value={Math.round(obj.fontSize)} onChange={(e) => patch({ fontSize: num(e.target.value) })} />
          </Row>
          <Row label="Color">
            <input type="color" value={obj.fill} onChange={(e) => patch({ fill: e.target.value })} className="h-8 w-full" />
          </Row>
          <Row label="Align">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={obj.align}
              onChange={(e) => patch({ align: e.target.value as 'left' | 'center' | 'right' })}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Row>
        </div>
      )}
    </div>
  );
}
