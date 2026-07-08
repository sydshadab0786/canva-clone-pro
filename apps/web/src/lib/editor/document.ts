/**
 * Pure operations over a SceneDocument. Every function returns a NEW document
 * (immutably) so the editor can snapshot before/after for undo/redo and React
 * can rely on referential changes. No side effects, no framework imports —
 * fully unit-testable.
 */
import type {
  EllipseObject,
  ImageObject,
  LineObject,
  ObjectId,
  RectObject,
  SceneDocument,
  SceneObject,
  TextObject,
} from './types';

let idCounter = 0;

/** Collision-resistant enough id for client-side objects. */
export function createId(prefix = 'obj'): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${idCounter}${rand}`;
}

const baseDefaults = (over: Partial<SceneObject>) => ({
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  groupId: null,
  ...over,
});

// ── Object factories ───────────────────────────────────────────────

export function makeText(over: Partial<TextObject> = {}): TextObject {
  return {
    ...baseDefaults(over),
    id: over.id ?? createId('text'),
    type: 'text',
    name: over.name ?? 'Text',
    width: over.width ?? 240,
    height: over.height ?? 48,
    text: over.text ?? 'Add your text',
    fontSize: over.fontSize ?? 36,
    fontFamily: over.fontFamily ?? 'Inter',
    fontStyle: over.fontStyle ?? 'normal',
    align: over.align ?? 'left',
    fill: over.fill ?? '#111827',
    lineHeight: over.lineHeight ?? 1.2,
    letterSpacing: over.letterSpacing ?? 0,
  } as TextObject;
}

export function makeRect(over: Partial<RectObject> = {}): RectObject {
  return {
    ...baseDefaults(over),
    id: over.id ?? createId('rect'),
    type: 'rect',
    name: over.name ?? 'Rectangle',
    width: over.width ?? 200,
    height: over.height ?? 140,
    fill: over.fill ?? '#7c3aed',
    stroke: over.stroke ?? null,
    strokeWidth: over.strokeWidth ?? 0,
    cornerRadius: over.cornerRadius ?? 0,
  } as RectObject;
}

export function makeEllipse(over: Partial<EllipseObject> = {}): EllipseObject {
  return {
    ...baseDefaults(over),
    id: over.id ?? createId('ellipse'),
    type: 'ellipse',
    name: over.name ?? 'Ellipse',
    width: over.width ?? 160,
    height: over.height ?? 160,
    fill: over.fill ?? '#ec4899',
    stroke: over.stroke ?? null,
    strokeWidth: over.strokeWidth ?? 0,
  } as EllipseObject;
}

export function makeLine(over: Partial<LineObject> = {}): LineObject {
  return {
    ...baseDefaults(over),
    id: over.id ?? createId('line'),
    type: 'line',
    name: over.name ?? 'Line',
    width: over.width ?? 200,
    height: over.height ?? 0,
    points: over.points ?? [0, 0, 200, 0],
    stroke: over.stroke ?? '#111827',
    strokeWidth: over.strokeWidth ?? 4,
  } as LineObject;
}

export function makeImage(src: string, over: Partial<ImageObject> = {}): ImageObject {
  return {
    ...baseDefaults(over),
    id: over.id ?? createId('image'),
    type: 'image',
    name: over.name ?? 'Image',
    width: over.width ?? 320,
    height: over.height ?? 240,
    src,
    cornerRadius: over.cornerRadius ?? 0,
  } as ImageObject;
}

// ── Queries ────────────────────────────────────────────────────────

export function findObject(doc: SceneDocument, id: ObjectId): SceneObject | undefined {
  return doc.objects.find((o) => o.id === id);
}

// ── Mutations (immutable) ──────────────────────────────────────────

export function addObject(doc: SceneDocument, object: SceneObject): SceneDocument {
  return { ...doc, objects: [...doc.objects, object] };
}

export function updateObject(
  doc: SceneDocument,
  id: ObjectId,
  patch: Partial<SceneObject>,
): SceneDocument {
  return {
    ...doc,
    objects: doc.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as SceneObject) : o)),
  };
}

/** Apply the same patch to many objects (e.g. drag a multi-selection). */
export function updateObjects(
  doc: SceneDocument,
  ids: ObjectId[],
  patch: (o: SceneObject) => Partial<SceneObject>,
): SceneDocument {
  const set = new Set(ids);
  return {
    ...doc,
    objects: doc.objects.map((o) => (set.has(o.id) ? ({ ...o, ...patch(o) } as SceneObject) : o)),
  };
}

export function removeObjects(doc: SceneDocument, ids: ObjectId[]): SceneDocument {
  const set = new Set(ids);
  // Removing a group also detaches its children (they become top-level).
  const objects = doc.objects
    .filter((o) => !set.has(o.id))
    .map((o) => (o.groupId && set.has(o.groupId) ? { ...o, groupId: null } : o));
  return { ...doc, objects };
}

// ── Z-order ────────────────────────────────────────────────────────

function move(doc: SceneDocument, id: ObjectId, target: (i: number, len: number) => number) {
  const index = doc.objects.findIndex((o) => o.id === id);
  if (index === -1) return doc;
  const objects = [...doc.objects];
  const [obj] = objects.splice(index, 1);
  if (!obj) return doc;
  const to = Math.max(0, Math.min(objects.length, target(index, objects.length)));
  objects.splice(to, 0, obj);
  return { ...doc, objects };
}

export const bringForward = (doc: SceneDocument, id: ObjectId) => move(doc, id, (i) => i + 1);
export const sendBackward = (doc: SceneDocument, id: ObjectId) => move(doc, id, (i) => i - 1);
export const bringToFront = (doc: SceneDocument, id: ObjectId) => move(doc, id, (_i, len) => len);
export const sendToBack = (doc: SceneDocument, id: ObjectId) => move(doc, id, () => 0);

/** Reorder via explicit indices (used by the layers panel drag-drop). */
export function reorder(doc: SceneDocument, from: number, to: number): SceneDocument {
  if (from === to || from < 0 || from >= doc.objects.length) return doc;
  const objects = [...doc.objects];
  const [obj] = objects.splice(from, 1);
  if (!obj) return doc;
  objects.splice(Math.max(0, Math.min(objects.length, to)), 0, obj);
  return { ...doc, objects };
}

// ── Grouping ───────────────────────────────────────────────────────

export function groupObjects(doc: SceneDocument, ids: ObjectId[]): { doc: SceneDocument; groupId: ObjectId } {
  const members = doc.objects.filter((o) => ids.includes(o.id));
  const groupId = createId('group');
  if (members.length < 2) return { doc, groupId };

  // Group bounding box (axis-aligned; rotation-aware bounds are a later refinement).
  const minX = Math.min(...members.map((o) => o.x));
  const minY = Math.min(...members.map((o) => o.y));
  const maxX = Math.max(...members.map((o) => o.x + o.width));
  const maxY = Math.max(...members.map((o) => o.y + o.height));

  const group: SceneObject = {
    id: groupId,
    type: 'group',
    name: 'Group',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    groupId: null,
  };

  const objects = doc.objects.map((o) => (ids.includes(o.id) ? { ...o, groupId } : o));
  return { doc: { ...doc, objects: [...objects, group] }, groupId };
}

export function ungroup(doc: SceneDocument, groupId: ObjectId): SceneDocument {
  const objects = doc.objects
    .filter((o) => o.id !== groupId)
    .map((o) => (o.groupId === groupId ? { ...o, groupId: null } : o));
  return { ...doc, objects };
}

export function memberIds(doc: SceneDocument, groupId: ObjectId): ObjectId[] {
  return doc.objects.filter((o) => o.groupId === groupId).map((o) => o.id);
}

/**
 * Duplicate the given objects, offset slightly so the copy is visible, and
 * append them on top. Returns the new document and the ids of the copies
 * (so the caller can select them).
 */
export function duplicateHelper(
  doc: SceneDocument,
  ids: ObjectId[],
  offset = 16,
): { doc: SceneDocument; newIds: ObjectId[] } {
  const set = new Set(ids);
  const copies: SceneObject[] = [];
  const newIds: ObjectId[] = [];
  for (const obj of doc.objects) {
    if (!set.has(obj.id)) continue;
    const id = createId(obj.type);
    newIds.push(id);
    copies.push({
      ...obj,
      id,
      x: obj.x + offset,
      y: obj.y + offset,
      name: `${obj.name} copy`,
      // Duplicated group members lose group membership for simplicity.
      groupId: null,
    } as SceneObject);
  }
  return { doc: { ...doc, objects: [...doc.objects, ...copies] }, newIds };
}
