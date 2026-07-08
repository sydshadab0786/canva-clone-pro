/**
 * Deterministic local text transforms — the fallback "AI" when no model key is
 * configured. Pure and unit-tested. Not a language model, but produces
 * predictable, useful edits so the product works end-to-end offline.
 */

const CONTRACTIONS: Record<string, string> = {
  "don't": 'do not',
  "can't": 'cannot',
  "won't": 'will not',
  "i'm": 'I am',
  "it's": 'it is',
  "we're": 'we are',
  "you're": 'you are',
  "they're": 'they are',
  "isn't": 'is not',
  "doesn't": 'does not',
  "let's": 'let us',
};

export type RewriteMode = 'shorten' | 'expand' | 'formal' | 'friendly' | 'fix';

export function localRewrite(text: string, mode: RewriteMode): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  switch (mode) {
    case 'shorten': {
      const sentences = trimmed.split(/(?<=[.!?])\s+/);
      return sentences[0] ?? trimmed;
    }
    case 'expand':
      return `${trimmed} In other words, this matters because it directly serves your audience's needs.`;
    case 'formal':
      return trimmed
        .replace(/\b[\w']+\b/g, (w) => CONTRACTIONS[w.toLowerCase()] ?? w)
        .replace(/!+/g, '.');
    case 'friendly':
      return `Hey! ${trimmed} 😊`;
    case 'fix':
      return trimmed
        .replace(/\s+([.,!?])/g, '$1')
        .replace(/(^\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
    default:
      return trimmed;
  }
}

export function localWriteCopy(prompt: string, tone = 'neutral'): string {
  const topic = prompt.trim().replace(/\s+/g, ' ') || 'your idea';
  const headlineWord = topic.split(' ').slice(0, 4).join(' ');
  const toneLead: Record<string, string> = {
    playful: 'Say hello to',
    bold: 'Introducing',
    professional: 'Presenting',
    neutral: 'Meet',
  };
  const lead = toneLead[tone] ?? toneLead.neutral;
  return [
    `${lead} ${headlineWord}`,
    `Everything you need for ${topic}, in one place.`,
    `Get started today — no experience required.`,
  ].join('\n');
}

// Tiny demonstrative dictionary; real translation requires the model provider.
const MINI_DICT: Record<string, Record<string, string>> = {
  es: { hello: 'hola', thanks: 'gracias', welcome: 'bienvenido', design: 'diseño', team: 'equipo' },
  fr: { hello: 'bonjour', thanks: 'merci', welcome: 'bienvenue', design: 'conception', team: 'équipe' },
  de: { hello: 'hallo', thanks: 'danke', welcome: 'willkommen', design: 'design', team: 'team' },
};

export function localTranslate(text: string, target: string): string {
  const dict = MINI_DICT[target];
  if (!dict) return `[${target}] ${text}`;
  return text.replace(/\b[\w']+\b/g, (w) => dict[w.toLowerCase()] ?? w);
}

export interface FontPairing {
  heading: string;
  body: string;
  vibe: string;
}

const PAIRINGS: FontPairing[] = [
  { heading: 'Playfair Display', body: 'Source Sans Pro', vibe: 'elegant / editorial' },
  { heading: 'Montserrat', body: 'Merriweather', vibe: 'modern / trustworthy' },
  { heading: 'Poppins', body: 'Inter', vibe: 'clean / tech' },
  { heading: 'Oswald', body: 'Lato', vibe: 'bold / sporty' },
  { heading: 'Abril Fatface', body: 'Roboto', vibe: 'fashion / statement' },
  { heading: 'Space Grotesk', body: 'IBM Plex Sans', vibe: 'startup / geometric' },
];

/** Deterministically pick 3 font pairings for a keyword (stable per keyword). */
export function recommendFonts(keyword: string): FontPairing[] {
  let hash = 0;
  for (let i = 0; i < keyword.length; i += 1) hash = (hash * 31 + keyword.charCodeAt(i)) >>> 0;
  const start = hash % PAIRINGS.length;
  return [0, 1, 2].map((o) => PAIRINGS[(start + o) % PAIRINGS.length]!);
}
