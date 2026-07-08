'use client';

import { useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  editorActions,
  selectDocument,
  selectSelectedIds,
  selectViewport,
} from '@/lib/features/editor/editorSlice';
import type { ObjectId, SceneObject } from '@/lib/editor/types';
import { UrlImage } from './UrlImage';

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;

interface Props {
  /** Viewport pixel size of the canvas container. */
  stageWidth: number;
  stageHeight: number;
}

/**
 * The interactive design surface. Renders the scene document with Konva,
 * supports wheel-zoom (anchored at the cursor), drag-to-pan, click/shift
 * selection, and a Transformer for resize/rotate. All mutations flow back
 * into the editor slice (live during a gesture, committed on gesture end).
 */
export function EditorCanvas({ stageWidth, stageHeight }: Props) {
  const dispatch = useAppDispatch();
  const doc = useAppSelector(selectDocument);
  const selectedIds = useAppSelector(selectSelectedIds);
  const viewport = useAppSelector(selectViewport);
  const { width, height, grid, snap } = useAppSelector((s) => ({
    width: s.editor.width,
    height: s.editor.height,
    grid: s.editor.grid,
    snap: s.editor.snap,
  }));

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  // model positions of selected objects captured at drag start (for group drag)
  const dragStartRef = useRef<Record<ObjectId, { x: number; y: number }> | null>(null);
  const dragAnchorRef = useRef<{ id: ObjectId; x: number; y: number } | null>(null);

  // Konva Ellipse is center-origin; everything else is top-left. These
  // helpers translate between the model (top-left) and the node.
  const modelPos = (obj: SceneObject, node: Konva.Node) =>
    obj.type === 'ellipse'
      ? { x: node.x() - obj.width / 2, y: node.y() - obj.height / 2 }
      : { x: node.x(), y: node.y() };

  // Attach the transformer to the currently selected nodes.
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, doc]);

  // ── Selection ─────────────────────────────────────────────────────
  const handleSelect = (id: ObjectId, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    const additive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
    if (additive) dispatch(editorActions.toggleSelection(id));
    else dispatch(editorActions.setSelection([id]));
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Click on empty stage → clear selection.
    if (e.target === e.target.getStage()) dispatch(editorActions.clearSelection());
  };

  // ── Zoom (wheel, anchored at pointer) ─────────────────────────────
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = viewport.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePoint = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    dispatch(
      editorActions.setViewport({
        scale: newScale,
        x: pointer.x - mousePoint.x * newScale,
        y: pointer.y - mousePoint.y * newScale,
      }),
    );
  };

  // ── Pan (drag empty stage) ────────────────────────────────────────
  const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === e.target.getStage()) {
      dispatch(editorActions.setViewport({ x: e.target.x(), y: e.target.y() }));
    }
  };

  // ── Object drag (supports moving a multi-selection together) ──────
  const beginDrag = (id: ObjectId) => {
    if (!selectedIds.includes(id)) dispatch(editorActions.setSelection([id]));
    dispatch(editorActions.beginInteraction());
    const ids = selectedIds.includes(id) ? selectedIds : [id];
    const starts: Record<ObjectId, { x: number; y: number }> = {};
    for (const oid of ids) {
      const o = doc.objects.find((x) => x.id === oid);
      if (o) starts[oid] = { x: o.x, y: o.y };
    }
    dragStartRef.current = starts;
    const anchor = doc.objects.find((x) => x.id === id);
    if (anchor) dragAnchorRef.current = { id, x: anchor.x, y: anchor.y };
  };

  const onDragMove = (obj: SceneObject, e: Konva.KonvaEventObject<DragEvent>) => {
    const starts = dragStartRef.current;
    const anchor = dragAnchorRef.current;
    if (!starts || !anchor) return;
    const pos = modelPos(obj, e.target);
    const dx = pos.x - anchor.x;
    const dy = pos.y - anchor.y;
    const changes: Record<ObjectId, Partial<SceneObject>> = {};
    for (const [oid, start] of Object.entries(starts)) {
      changes[oid] = { x: start.x + dx, y: start.y + dy };
    }
    dispatch(editorActions.updateLive(changes));
  };

  const endDrag = () => {
    dragStartRef.current = null;
    dragAnchorRef.current = null;
    dispatch(editorActions.endInteraction());
  };

  // ── Transform (resize / rotate) → bake scale into width/height ────
  const handleTransformEnd = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const changes: Record<ObjectId, Partial<SceneObject>> = {};
    for (const id of selectedIds) {
      const node = stage.findOne(`#${id}`);
      const obj = doc.objects.find((o) => o.id === id);
      if (!node || !obj) continue;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const newWidth = Math.max(4, obj.width * scaleX);
      const newHeight = Math.max(4, obj.height * scaleY);
      node.scaleX(1);
      node.scaleY(1);
      const patch: Partial<SceneObject> = {
        width: newWidth,
        height: newHeight,
        rotation: node.rotation(),
      };
      const pos = modelPos(obj, node);
      patch.x = pos.x;
      patch.y = pos.y;
      if (obj.type === 'text') {
        (patch as Partial<Extract<SceneObject, { type: 'text' }>>).fontSize = Math.max(
          4,
          obj.fontSize * scaleY,
        );
      }
      changes[id] = patch;
    }
    dispatch(editorActions.beginInteraction());
    dispatch(editorActions.updateLive(changes));
    dispatch(editorActions.endInteraction());
  };

  // Optional grid — light lines every 50px in canvas space.
  const gridLines = [] as React.ReactNode[];
  if (grid) {
    const step = 50;
    for (let x = step; x < width; x += step) {
      gridLines.push(
        <Line key={`gx${x}`} points={[x, 0, x, height]} stroke="#e5e7eb" strokeWidth={1} listening={false} />,
      );
    }
    for (let y = step; y < height; y += step) {
      gridLines.push(
        <Line key={`gy${y}`} points={[0, y, width, y]} stroke="#e5e7eb" strokeWidth={1} listening={false} />,
      );
    }
  }

  const renderObject = (obj: SceneObject) => {
    const draggable = !obj.locked && obj.visible;
    const common = {
      id: obj.id,
      draggable,
      listening: obj.visible && !obj.locked,
      visible: obj.visible,
      opacity: obj.opacity,
      rotation: obj.rotation,
      onMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => handleSelect(obj.id, e),
      onTap: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => handleSelect(obj.id, e),
      onDragStart: () => beginDrag(obj.id),
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => onDragMove(obj, e),
      onDragEnd: endDrag,
    };

    switch (obj.type) {
      case 'rect':
        return (
          <Rect
            key={obj.id}
            {...common}
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            fill={obj.fill}
            stroke={obj.stroke ?? undefined}
            strokeWidth={obj.strokeWidth}
            cornerRadius={obj.cornerRadius}
          />
        );
      case 'ellipse':
        return (
          <Ellipse
            key={obj.id}
            {...common}
            x={obj.x + obj.width / 2}
            y={obj.y + obj.height / 2}
            radiusX={obj.width / 2}
            radiusY={obj.height / 2}
            fill={obj.fill}
            stroke={obj.stroke ?? undefined}
            strokeWidth={obj.strokeWidth}
          />
        );
      case 'line':
        return (
          <Line
            key={obj.id}
            {...common}
            x={obj.x}
            y={obj.y}
            points={obj.points}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth}
            lineCap="round"
          />
        );
      case 'text':
        return (
          <Text
            key={obj.id}
            {...common}
            x={obj.x}
            y={obj.y}
            width={obj.width}
            text={obj.text}
            fontSize={obj.fontSize}
            fontFamily={obj.fontFamily}
            fontStyle={obj.fontStyle}
            align={obj.align}
            fill={obj.fill}
            lineHeight={obj.lineHeight}
            letterSpacing={obj.letterSpacing}
          />
        );
      case 'image':
        return (
          <UrlImage
            key={obj.id}
            obj={obj}
            draggable={draggable}
            onSelect={(e) => handleSelect(obj.id, e)}
            onDragStart={() => beginDrag(obj.id)}
            onDragMove={(e) => onDragMove(obj, e)}
            onDragEnd={endDrag}
          />
        );
      case 'group':
        // Group is a logical bounding box; children render independently.
        return null;
      default:
        return null;
    }
  };

  return (
    <Stage
      ref={stageRef}
      width={stageWidth}
      height={stageHeight}
      scaleX={viewport.scale}
      scaleY={viewport.scale}
      x={viewport.x}
      y={viewport.y}
      draggable
      onWheel={handleWheel}
      onMouseDown={handleStageMouseDown}
      onDragEnd={handleStageDragEnd}
      style={{ background: '#f3f4f6' }}
    >
      {/* Artboard + content */}
      <Layer>
        <Rect x={0} y={0} width={width} height={height} fill={doc.background} shadowBlur={12} shadowOpacity={0.15} />
        {gridLines}
        {doc.objects.map(renderObject)}
      </Layer>
      {/* Selection UI on its own layer */}
      <Layer>
        <Transformer
          ref={transformerRef}
          rotateEnabled
          keepRatio={false}
          onTransformEnd={handleTransformEnd}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 8 || newBox.height < 8 ? oldBox : newBox)}
          anchorSize={8}
          anchorCornerRadius={2}
          borderStroke="#7c3aed"
          anchorStroke="#7c3aed"
        />
      </Layer>
      {/* `snap` reserved for guide-snapping in a follow-up; referenced to keep intent explicit */}
      {snap ? null : null}
    </Stage>
  );
}
