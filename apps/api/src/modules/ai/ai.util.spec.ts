import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  generatePalette,
  hexToRgb,
  hslToHex,
  wcagLevel,
} from './color.util';
import { checkAccessibility } from './accessibility.util';
import { localRewrite, localTranslate, recommendFonts } from './text.util';

describe('color.util', () => {
  it('parses 3- and 6-digit hex', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('7c3aed')).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('computes WCAG contrast ratio (black on white = 21)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('classifies WCAG levels', () => {
    expect(wcagLevel(21)).toBe('AAA');
    expect(wcagLevel(5)).toBe('AA');
    expect(wcagLevel(3.2, true)).toBe('AA Large');
    expect(wcagLevel(2)).toBe('Fail');
  });

  it('generates deterministic palettes of 5 valid hex colours', () => {
    const a = generatePalette('ocean sunrise');
    const b = generatePalette('ocean sunrise');
    expect(a).toEqual(b); // deterministic
    expect(a).toHaveLength(5);
    a.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
    expect(generatePalette('ocean sunrise', 'triadic')).not.toEqual(a);
  });

  it('hslToHex round-trips primary hues sanely', () => {
    expect(hslToHex(0, 1, 0.5)).toBe('#ff0000');
    expect(hslToHex(120, 1, 0.5)).toBe('#00ff00');
    expect(hslToHex(240, 1, 0.5)).toBe('#0000ff');
  });
});

describe('accessibility.util', () => {
  it('flags low-contrast text over the background', () => {
    const scene = {
      background: '#ffffff',
      objects: [
        { id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 50, fill: '#eeeeee', fontSize: 20, text: 'hi' },
      ],
    };
    const report = checkAccessibility(scene);
    expect(report.issues.some((i) => i.kind === 'contrast' && i.objectId === 't1')).toBe(true);
    expect(report.score).toBeLessThan(100);
  });

  it('passes high-contrast text and uses the overlapping shape as background', () => {
    const scene = {
      background: '#ffffff',
      objects: [
        { id: 'bg', type: 'rect', x: 0, y: 0, width: 400, height: 200, fill: '#111827' },
        { id: 't1', type: 'text', x: 20, y: 20, width: 200, height: 40, fill: '#ffffff', fontSize: 32, text: 'Hello' },
      ],
    };
    const report = checkAccessibility(scene);
    expect(report.issues.filter((i) => i.kind === 'contrast')).toHaveLength(0);
    expect(report.score).toBe(100);
  });

  it('warns on empty text layers', () => {
    const scene = {
      background: '#ffffff',
      objects: [{ id: 't1', type: 'text', x: 0, y: 0, width: 100, height: 20, fill: '#000', text: '   ' }],
    };
    expect(checkAccessibility(scene).issues.some((i) => i.kind === 'empty-text')).toBe(true);
  });
});

describe('text.util', () => {
  it('shortens to the first sentence', () => {
    expect(localRewrite('First one. Second two. Third three.', 'shorten')).toBe('First one.');
  });

  it('formalizes contractions and drops exclamations', () => {
    expect(localRewrite("I'm sure we can't lose!", 'formal')).toBe('I am sure we cannot lose.');
  });

  it('translates known words via the mini dictionary', () => {
    expect(localTranslate('hello team', 'es')).toBe('hola equipo');
    expect(localTranslate('hello', 'xx')).toBe('[xx] hello');
  });

  it('recommends 3 stable font pairings per keyword', () => {
    const a = recommendFonts('wedding');
    expect(a).toHaveLength(3);
    expect(recommendFonts('wedding')).toEqual(a);
    a.forEach((p) => expect(p.heading && p.body).toBeTruthy());
  });
});
