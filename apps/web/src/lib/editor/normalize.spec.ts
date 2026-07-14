import { describe, expect, it } from 'vitest';
import { estimateTextHeight, normalizeScene } from './normalize';

/** Every numeric geometry field must be finite — NaN is what breaks the canvas. */
function expectFiniteGeometry(o: Record<string, unknown>) {
  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'opacity']) {
    expect(Number.isFinite(o[key] as number), `${key} = ${o[key]}`).toBe(true);
  }
}

describe('normalizeScene', () => {
  it('derives height for template text that omits it (the NaN bug)', () => {
    // This is verbatim the shape seeded templates produce: no `height`.
    const raw = {
      version: 1,
      background: '#ffffff',
      objects: [
        {
          id: 'text_9',
          type: 'text',
          name: 'Text',
          x: 40,
          y: 80,
          width: 200,
          fontSize: 44,
          lineHeight: 1.2,
          text: 'JANE\nDOE',
          fill: '#ffffff',
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          groupId: null,
        },
      ],
    };

    const doc = normalizeScene(raw);
    const text = doc.objects[0]!;
    expectFiniteGeometry(text as unknown as Record<string, unknown>);
    // 44px × 1.2 line-height × 2 lines
    expect(text.height).toBe(106);
  });

  it('keeps an explicit height when one is provided', () => {
    const doc = normalizeScene({
      objects: [{ type: 'text', width: 100, height: 55, fontSize: 20, text: 'hi' }],
    });
    expect(doc.objects[0]!.height).toBe(55);
  });

  it('fills every missing field on a bare object', () => {
    const doc = normalizeScene({ objects: [{ type: 'rect' }] });
    const rect = doc.objects[0]!;
    expectFiniteGeometry(rect as unknown as Record<string, unknown>);
    expect(rect.id).toBeTruthy();
    expect(rect.visible).toBe(true);
    expect(rect.locked).toBe(false);
    expect(rect.groupId).toBeNull();
  });

  it('coerces non-numeric / NaN geometry to safe values', () => {
    const doc = normalizeScene({
      objects: [
        { type: 'rect', x: 'abc', y: null, width: NaN, height: undefined, opacity: 5, rotation: 'x' },
      ],
    });
    const r = doc.objects[0]!;
    expectFiniteGeometry(r as unknown as Record<string, unknown>);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
    expect(r.opacity).toBe(1); // clamped into 0..1
  });

  it('drops unknown object types instead of rendering garbage', () => {
    const doc = normalizeScene({ objects: [{ type: 'hologram' }, { type: 'rect' }] });
    expect(doc.objects).toHaveLength(1);
    expect(doc.objects[0]!.type).toBe('rect');
  });

  it('handles a completely empty / missing document', () => {
    expect(normalizeScene(undefined)).toEqual({ version: 1, background: '#ffffff', objects: [] });
    expect(normalizeScene({})).toEqual({ version: 1, background: '#ffffff', objects: [] });
    expect(normalizeScene({ objects: 'not-an-array' }).objects).toEqual([]);
  });

  it('defaults line points and keeps a usable stroke width', () => {
    const line = normalizeScene({ objects: [{ type: 'line', width: 250 }] }).objects[0]!;
    expect(line.type).toBe('line');
    expect((line as { points: number[] }).points).toEqual([0, 0, 250, 0]);
    expect((line as { strokeWidth: number }).strokeWidth).toBeGreaterThan(0);
  });
});

describe('estimateTextHeight', () => {
  it('scales with font size, line height and line count', () => {
    expect(estimateTextHeight('one line', 20, 1.2)).toBe(24);
    expect(estimateTextHeight('two\nlines', 20, 1.2)).toBe(48);
    expect(estimateTextHeight('', 20, 1.2)).toBe(24); // empty still occupies a line
  });
});
