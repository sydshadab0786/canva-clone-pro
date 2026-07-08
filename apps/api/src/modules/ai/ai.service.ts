import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../common/config/configuration';
import { AnthropicClient } from './anthropic.client';
import { generatePalette, hslToHex } from './color.util';
import { checkAccessibility, type AccessibilityReport } from './accessibility.util';
import {
  localRewrite,
  localTranslate,
  localWriteCopy,
  recommendFonts,
  type FontPairing,
  type RewriteMode,
} from './text.util';

interface Scene {
  background?: string;
  objects?: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontFamily?: string;
    fill?: string;
  }>;
}

@Injectable()
export class AiService {
  private readonly mode: 'local' | 'anthropic';

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly anthropic: AnthropicClient,
  ) {
    this.mode = config.get('ai', { infer: true }).provider;
  }

  get engine(): 'local' | 'anthropic' {
    return this.anthropic.enabled ? 'anthropic' : 'local';
  }

  // ── Text ───────────────────────────────────────────────────────
  async writeCopy(prompt: string, tone = 'neutral'): Promise<string> {
    if (this.anthropic.enabled) {
      return this.anthropic.complete(
        `You are a marketing copywriter. Write in a ${tone} tone. Return only the copy, no preamble.`,
        prompt,
      );
    }
    return localWriteCopy(prompt, tone);
  }

  async rewrite(text: string, mode: RewriteMode): Promise<string> {
    if (this.anthropic.enabled) {
      const instruction: Record<RewriteMode, string> = {
        shorten: 'Make it more concise.',
        expand: 'Expand it with more detail.',
        formal: 'Rewrite it in a formal, professional tone.',
        friendly: 'Rewrite it in a warm, friendly tone.',
        fix: 'Fix grammar, spelling and punctuation.',
      };
      return this.anthropic.complete(
        `You are an editor. ${instruction[mode]} Return only the rewritten text.`,
        text,
      );
    }
    return localRewrite(text, mode);
  }

  async translate(text: string, target: string): Promise<string> {
    if (this.anthropic.enabled) {
      return this.anthropic.complete(
        `Translate the user's text into ${target}. Return only the translation.`,
        text,
      );
    }
    return localTranslate(text, target);
  }

  // ── Deterministic creative helpers (local-quality regardless of mode) ──
  colorPalette(prompt: string, harmony: 'analogous' | 'complementary' | 'triadic' = 'analogous') {
    return { prompt, harmony, colors: generatePalette(prompt, harmony) };
  }

  fontRecommendations(keyword: string): FontPairing[] {
    return recommendFonts(keyword);
  }

  accessibility(scene: Scene): AccessibilityReport {
    return checkAccessibility(scene);
  }

  /** Heuristic design critique over the scene graph. */
  designSuggestions(scene: Scene): string[] {
    const objects = scene.objects ?? [];
    const tips: string[] = [];

    const fonts = new Set(objects.filter((o) => o.type === 'text').map((o) => o.fontFamily));
    if (fonts.size > 3) tips.push(`You're using ${fonts.size} fonts — limit to 2–3 for a cohesive look.`);

    const colors = new Set(objects.map((o) => o.fill).filter(Boolean));
    if (colors.size > 6) tips.push(`There are ${colors.size} distinct colors — a tighter palette reads cleaner.`);

    if (objects.length === 0) tips.push('The canvas is empty — start with a headline or a background shape.');

    const a11y = checkAccessibility(scene);
    if (a11y.issues.some((i) => i.kind === 'contrast')) {
      tips.push('Some text fails contrast checks — darken text or lighten its background.');
    }

    if (tips.length === 0) tips.push('Looking good! Balanced layout, readable text, and a tight palette.');
    return tips;
  }

  // ── Image generation (deterministic SVG placeholder) ───────────
  /**
   * Without a diffusion model wired in, produce a deterministic gradient poster
   * as an SVG data URL derived from the prompt. Structured so a real provider
   * (e.g. an S3-stored render) can drop in behind the same method signature.
   */
  generateImage(prompt: string, width = 1024, height = 1024): { url: string; width: number; height: number; engine: string } {
    let hash = 0;
    for (let i = 0; i < prompt.length; i += 1) hash = (hash * 31 + prompt.charCodeAt(i)) >>> 0;
    const h1 = hash % 360;
    const c1 = hslToHex(h1, 0.7, 0.55);
    const c2 = hslToHex(h1 + 40, 0.7, 0.4);
    const label = prompt.trim().slice(0, 40).replace(/[<&>]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#g)"/>
<text x="50%" y="50%" fill="#ffffff" font-family="sans-serif" font-size="${Math.round(width / 18)}" font-weight="700" text-anchor="middle" opacity="0.9">${label}</text>
</svg>`;
    const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    return { url, width, height, engine: 'local-svg' };
  }
}
