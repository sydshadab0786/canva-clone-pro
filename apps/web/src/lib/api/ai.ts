import { apiFetch } from '../api-client';
import type { SceneDocument } from '@/lib/editor/types';

export type RewriteMode = 'shorten' | 'expand' | 'formal' | 'friendly' | 'fix';

export function aiWrite(prompt: string, tone?: string): Promise<{ text: string; engine: string }> {
  return apiFetch('/ai/text/write', { method: 'POST', body: { prompt, tone } });
}

export function aiRewrite(text: string, mode: RewriteMode): Promise<{ text: string; engine: string }> {
  return apiFetch('/ai/text/rewrite', { method: 'POST', body: { text, mode } });
}

export function aiTranslate(text: string, target: string): Promise<{ text: string; engine: string }> {
  return apiFetch('/ai/text/translate', { method: 'POST', body: { text, target } });
}

export function aiPalette(
  prompt: string,
  harmony?: 'analogous' | 'complementary' | 'triadic',
): Promise<{ prompt: string; harmony: string; colors: string[] }> {
  return apiFetch('/ai/color-palette', { method: 'POST', body: { prompt, harmony } });
}

export interface FontPairing {
  heading: string;
  body: string;
  vibe: string;
}
export function aiFonts(keyword: string): Promise<{ pairings: FontPairing[] }> {
  return apiFetch('/ai/font-recommendation', { method: 'POST', body: { keyword } });
}

export function aiSuggestions(scene: SceneDocument): Promise<{ suggestions: string[] }> {
  return apiFetch('/ai/design-suggestions', { method: 'POST', body: { scene } });
}

export interface AccessibilityIssue {
  objectId: string;
  label: string;
  kind: 'contrast' | 'small-text' | 'empty-text';
  severity: 'error' | 'warning';
  detail: string;
  ratio?: number;
  level?: string;
}
export interface AccessibilityReport {
  score: number;
  passed: number;
  total: number;
  issues: AccessibilityIssue[];
}
export function aiAccessibility(scene: SceneDocument): Promise<AccessibilityReport> {
  return apiFetch('/ai/accessibility-check', { method: 'POST', body: { scene } });
}

export function aiGenerateImage(
  prompt: string,
  width?: number,
  height?: number,
): Promise<{ url: string; width: number; height: number; engine: string }> {
  return apiFetch('/ai/image/generate', { method: 'POST', body: { prompt, width, height } });
}
