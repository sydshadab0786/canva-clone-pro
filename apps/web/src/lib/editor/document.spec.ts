import { describe, expect, it } from 'vitest';
import { emptyDocument } from './types';
import {
  addObject,
  bringToFront,
  groupObjects,
  makeEllipse,
  makeRect,
  makeText,
  memberIds,
  removeObjects,
  reorder,
  sendToBack,
  ungroup,
  updateObject,
  updateObjects,
} from './document';

function docWith3() {
  let doc = emptyDocument();
  doc = addObject(doc, makeRect({ id: 'a' }));
  doc = addObject(doc, makeEllipse({ id: 'b' }));
  doc = addObject(doc, makeText({ id: 'c' }));
  return doc;
}

describe('document operations', () => {
  it('adds objects in z-order and never mutates the input', () => {
    const doc = emptyDocument();
    const next = addObject(doc, makeRect({ id: 'a' }));
    expect(doc.objects).toHaveLength(0); // input untouched (immutability)
    expect(next.objects.map((o) => o.id)).toEqual(['a']);
  });

  it('updates a single object by id', () => {
    const doc = docWith3();
    const next = updateObject(doc, 'b', { x: 50, y: 60 });
    expect(next.objects.find((o) => o.id === 'b')).toMatchObject({ x: 50, y: 60 });
    // others unchanged
    expect(next.objects.find((o) => o.id === 'a')?.x).toBe(0);
  });

  it('applies a functional patch to a multi-selection', () => {
    const doc = docWith3();
    const next = updateObjects(doc, ['a', 'c'], (o) => ({ x: o.x + 10 }));
    expect(next.objects.find((o) => o.id === 'a')?.x).toBe(10);
    expect(next.objects.find((o) => o.id === 'c')?.x).toBe(10);
    expect(next.objects.find((o) => o.id === 'b')?.x).toBe(0);
  });

  it('removes objects and detaches orphaned group children', () => {
    let doc = docWith3();
    const grouped = groupObjects(doc, ['a', 'b']);
    doc = grouped.doc;
    // remove the group → its members should be detached, not deleted
    doc = removeObjects(doc, [grouped.groupId]);
    expect(doc.objects.find((o) => o.id === grouped.groupId)).toBeUndefined();
    expect(doc.objects.find((o) => o.id === 'a')?.groupId).toBeNull();
    expect(doc.objects.find((o) => o.id === 'b')?.groupId).toBeNull();
  });

  it('reorders z-index with bringToFront / sendToBack', () => {
    const doc = docWith3(); // [a, b, c]
    expect(bringToFront(doc, 'a').objects.map((o) => o.id)).toEqual(['b', 'c', 'a']);
    expect(sendToBack(doc, 'c').objects.map((o) => o.id)).toEqual(['c', 'a', 'b']);
  });

  it('reorders by explicit index (layers panel drag)', () => {
    const doc = docWith3(); // [a, b, c]
    expect(reorder(doc, 0, 2).objects.map((o) => o.id)).toEqual(['b', 'c', 'a']);
  });

  it('groups >=2 objects and assigns a group bounding box', () => {
    let doc = emptyDocument();
    doc = addObject(doc, makeRect({ id: 'a', x: 0, y: 0, width: 100, height: 100 }));
    doc = addObject(doc, makeRect({ id: 'b', x: 100, y: 100, width: 100, height: 100 }));
    const { doc: grouped, groupId } = groupObjects(doc, ['a', 'b']);
    const group = grouped.objects.find((o) => o.id === groupId)!;
    expect(group.type).toBe('group');
    expect(group).toMatchObject({ x: 0, y: 0, width: 200, height: 200 });
    expect(memberIds(grouped, groupId).sort()).toEqual(['a', 'b']);
  });

  it('does not create a group for a single object', () => {
    const doc = docWith3();
    const { doc: next } = groupObjects(doc, ['a']);
    expect(next.objects.some((o) => o.type === 'group')).toBe(false);
  });

  it('ungroups, clearing member groupId and removing the group node', () => {
    let doc = docWith3();
    const { doc: grouped, groupId } = groupObjects(doc, ['a', 'b']);
    doc = ungroup(grouped, groupId);
    expect(doc.objects.some((o) => o.id === groupId)).toBe(false);
    expect(doc.objects.find((o) => o.id === 'a')?.groupId).toBeNull();
  });
});
