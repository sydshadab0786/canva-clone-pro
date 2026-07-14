/**
 * Scene normalisation — the editor's trust boundary.
 *
 * A document can arrive from anywhere: a seeded template, an older autosave, a
 * hand-edited JSON blob, a future schema version. If any geometry field is
 * missing, arithmetic like `width * scaleX` silently yields NaN and the object
 * breaks the moment it is selected, resized or grouped.
 *
 * So we never trust an incoming document: every object is coerced into a fully
 * populated SceneObject before it reaches the canvas. Pure + unit-tested.
 */
import type {
  EllipseObject,
  ImageObject,
  LineObject,
  RectObject,
  SceneDocument,
  SceneObject,
  TextObject,
} from './types';
import { createId } from './document';

/** Coerce to a finite number, else fall back. */
function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Estimate a text box's height from its typography when none was supplied.
 * Mirrors how the canvas lays text out: fontSize × lineHeight × line count.
 */
export function estimateTextHeight(text: string, fontSize: number, lineHeight: number): number {
  const lines = Math.max(1, String(text ?? '').split('\n').length);
  return Math.round(fontSize * lineHeight * lines);
}

type Raw = Record<string, unknown>;

function normalizeObject(raw: Raw): SceneObject | null {
  const type = raw.type;
  if (typeof type !== 'string') return null;

  const base = {
    id: str(raw.id, createId(type)),
    name: str(raw.name, type.charAt(0).toUpperCase() + type.slice(1)),
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    width: Math.max(1, num(raw.width, 100)),
    // height is intentionally resolved per-type below (text can derive it).
    height: num(raw.height, NaN),
    rotation: num(raw.rotation, 0),
    opacity: Math.min(1, Math.max(0, num(raw.opacity, 1))),
    locked: bool(raw.locked, false),
    visible: bool(raw.visible, true),
    groupId: typeof raw.groupId === 'string' ? raw.groupId : null,
  };

  switch (type) {
    case 'text': {
      const fontSize = Math.max(1, num(raw.fontSize, 32));
      const lineHeight = num(raw.lineHeight, 1.2);
      const text = typeof raw.text === 'string' ? raw.text : '';
      return {
        ...base,
        // Templates commonly omit height for text — derive it from typography.
        height: Number.isFinite(base.height)
          ? Math.max(1, base.height)
          : estimateTextHeight(text, fontSize, lineHeight),
        type: 'text',
        text,
        fontSize,
        fontFamily: str(raw.fontFamily, 'Inter'),
        fontStyle: (['normal', 'bold', 'italic', 'italic bold'] as const).includes(
          raw.fontStyle as never,
        )
          ? (raw.fontStyle as TextObject['fontStyle'])
          : 'normal',
        align: (['left', 'center', 'right'] as const).includes(raw.align as never)
          ? (raw.align as TextObject['align'])
          : 'left',
        fill: str(raw.fill, '#111827'),
        lineHeight,
        letterSpacing: num(raw.letterSpacing, 0),
      } satisfies TextObject;
    }
    case 'rect':
      return {
        ...base,
        height: Math.max(1, num(raw.height, 100)),
        type: 'rect',
        fill: str(raw.fill, '#7c3aed'),
        stroke: typeof raw.stroke === 'string' ? raw.stroke : null,
        strokeWidth: num(raw.strokeWidth, 0),
        cornerRadius: num(raw.cornerRadius, 0),
      } satisfies RectObject;
    case 'ellipse':
      return {
        ...base,
        height: Math.max(1, num(raw.height, 100)),
        type: 'ellipse',
        fill: str(raw.fill, '#ec4899'),
        stroke: typeof raw.stroke === 'string' ? raw.stroke : null,
        strokeWidth: num(raw.strokeWidth, 0),
      } satisfies EllipseObject;
    case 'line': {
      const points = Array.isArray(raw.points)
        ? raw.points.map((p) => num(p, 0))
        : [0, 0, base.width, 0];
      return {
        ...base,
        height: Math.max(1, num(raw.height, 1)),
        type: 'line',
        points,
        stroke: str(raw.stroke, '#111827'),
        strokeWidth: Math.max(1, num(raw.strokeWidth, 4)),
      } satisfies LineObject;
    }
    case 'image':
      return {
        ...base,
        height: Math.max(1, num(raw.height, 100)),
        type: 'image',
        src: str(raw.src, ''),
        cornerRadius: num(raw.cornerRadius, 0),
      } satisfies ImageObject;
    case 'group':
      return {
        ...base,
        height: Math.max(1, num(raw.height, 100)),
        type: 'group',
      } satisfies SceneObject;
    default:
      // Unknown object type (newer schema?) — drop it rather than crash.
      return null;
  }
}

/** Coerce an arbitrary payload into a fully-populated, renderable SceneDocument. */
export function normalizeScene(raw: unknown, fallbackBackground = '#ffffff'): SceneDocument {
  const doc = (raw ?? {}) as Raw;
  const objects = Array.isArray(doc.objects) ? (doc.objects as unknown as Raw[]) : [];
  return {
    version: num(doc.version, 1),
    background: str(doc.background, fallbackBackground),
    objects: objects.map(normalizeObject).filter((o): o is SceneObject => o !== null),
  };
}
