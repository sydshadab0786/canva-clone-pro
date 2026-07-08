/**
 * Framework-agnostic scene model for the editor.
 *
 * The document is a flat, ordered list of objects (z-order = array order).
 * Keeping it flat + serializable means it maps 1:1 to the JSON persisted in
 * `Project.document`, can be diffed for collaboration later, and is trivial
 * to snapshot for undo/redo.
 */

export type ObjectId = string;

export interface BaseObject {
  id: ObjectId;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  locked: boolean;
  visible: boolean;
  /** Group membership; null when top-level. */
  groupId: ObjectId | null;
}

export interface TextObject extends BaseObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'italic bold';
  align: 'left' | 'center' | 'right';
  fill: string;
  lineHeight: number;
  letterSpacing: number;
}

export interface RectObject extends BaseObject {
  type: 'rect';
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  cornerRadius: number;
}

export interface EllipseObject extends BaseObject {
  type: 'ellipse';
  fill: string;
  stroke: string | null;
  strokeWidth: number;
}

export interface LineObject extends BaseObject {
  type: 'line';
  points: number[]; // [x1, y1, x2, y2, ...] relative to (x, y)
  stroke: string;
  strokeWidth: number;
}

export interface ImageObject extends BaseObject {
  type: 'image';
  src: string;
  cornerRadius: number;
}

export interface GroupObject extends BaseObject {
  type: 'group';
}

export type SceneObject =
  | TextObject
  | RectObject
  | EllipseObject
  | LineObject
  | ImageObject
  | GroupObject;

export type SceneObjectType = SceneObject['type'];

export interface SceneDocument {
  version: number;
  background: string;
  objects: SceneObject[];
}

export function emptyDocument(background = '#ffffff'): SceneDocument {
  return { version: 1, background, objects: [] };
}
