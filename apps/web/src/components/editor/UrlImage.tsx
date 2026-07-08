'use client';

import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import { forwardRef } from 'react';
import type { ImageObject } from '@/lib/editor/types';

interface Props {
  obj: ImageObject;
  draggable: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: () => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: () => void;
}

/** Konva image node that resolves its bitmap via the `use-image` hook. */
export const UrlImage = forwardRef<Konva.Image, Props>(function UrlImage(
  { obj, draggable, onSelect, onDragStart, onDragMove, onDragEnd },
  ref,
) {
  const [image] = useImage(obj.src, 'anonymous');
  return (
    <KonvaImage
      ref={ref}
      id={obj.id}
      image={image}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation}
      opacity={obj.opacity}
      cornerRadius={obj.cornerRadius}
      draggable={draggable}
      listening={obj.visible && !obj.locked}
      visible={obj.visible}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    />
  );
});
