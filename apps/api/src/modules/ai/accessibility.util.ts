import { contrastRatio, wcagLevel, type WcagLevel } from './color.util';

// Minimal structural typing of the scene (kept loose so the API doesn't
// depend on the web package's editor types).
interface SceneObj {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  fontSize?: number;
  text?: string;
  name?: string;
}
interface Scene {
  background?: string;
  objects?: SceneObj[];
}

export interface AccessibilityIssue {
  objectId: string;
  label: string;
  kind: 'contrast' | 'small-text' | 'empty-text';
  severity: 'error' | 'warning';
  detail: string;
  ratio?: number;
  level?: WcagLevel;
}

export interface AccessibilityReport {
  score: number; // 0..100
  passed: number;
  total: number;
  issues: AccessibilityIssue[];
}

function overlaps(a: SceneObj, b: SceneObj): boolean {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

/**
 * Determine a text object's effective background: the top-most non-text object
 * below it in z-order that overlaps it, else the artboard background.
 */
function backgroundFor(scene: Scene, index: number): string {
  const objects = scene.objects ?? [];
  const text = objects[index]!;
  for (let i = index - 1; i >= 0; i -= 1) {
    const o = objects[i]!;
    if (o.type === 'text') continue;
    if (o.fill && overlaps(text, o)) return o.fill;
  }
  return scene.background ?? '#ffffff';
}

/**
 * Static accessibility audit of a design: text/background contrast (WCAG 2.1),
 * minimum readable text size, and empty text placeholders. Large text uses a
 * relaxed contrast threshold per WCAG (>=18.66px bold / 24px regular ≈ "large").
 */
export function checkAccessibility(scene: Scene): AccessibilityReport {
  const objects = scene.objects ?? [];
  const issues: AccessibilityIssue[] = [];
  let checks = 0;
  let passed = 0;

  objects.forEach((obj, i) => {
    if (obj.type !== 'text') return;
    const label = obj.name || obj.text?.slice(0, 20) || 'Text';

    if (!obj.text || obj.text.trim().length === 0) {
      issues.push({
        objectId: obj.id,
        label,
        kind: 'empty-text',
        severity: 'warning',
        detail: 'Text layer is empty.',
      });
      return;
    }

    const fontSize = obj.fontSize ?? 16;
    if (fontSize < 12) {
      issues.push({
        objectId: obj.id,
        label,
        kind: 'small-text',
        severity: 'warning',
        detail: `Font size ${Math.round(fontSize)}px may be hard to read (min 12px recommended).`,
      });
    }

    if (obj.fill) {
      const bg = backgroundFor(scene, i);
      const ratio = contrastRatio(obj.fill, bg);
      const largeText = fontSize >= 24;
      const level = wcagLevel(ratio, largeText);
      checks += 1;
      if (level === 'Fail') {
        issues.push({
          objectId: obj.id,
          label,
          kind: 'contrast',
          severity: 'error',
          detail: `Contrast ${ratio.toFixed(2)}:1 against ${bg} fails WCAG AA.`,
          ratio,
          level,
        });
      } else {
        passed += 1;
      }
    }
  });

  const score = checks === 0 ? 100 : Math.round((passed / checks) * 100);
  return { score, passed, total: checks, issues };
}
