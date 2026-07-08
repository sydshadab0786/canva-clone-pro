import { AssetType } from '@prisma/client';

/** Map a MIME type to our AssetType taxonomy. Order matters (svg/gif before image). */
export function assetTypeFromMime(mime: string): AssetType {
  const m = mime.toLowerCase();
  if (m === 'image/svg+xml') return AssetType.SVG;
  if (m === 'image/gif') return AssetType.GIF;
  if (m.startsWith('image/')) return AssetType.IMAGE;
  if (m.startsWith('video/')) return AssetType.VIDEO;
  if (m.startsWith('audio/')) return AssetType.AUDIO;
  if (m === 'application/pdf') return AssetType.PDF;
  if (m.startsWith('font/') || m.includes('font')) return AssetType.FONT;
  if (m === 'application/json' && false) return AssetType.LOTTIE; // reserved
  if (m.startsWith('model/')) return AssetType.THREE_D;
  return AssetType.IMAGE;
}

// Accepted upload MIME prefixes/exact types (defense against arbitrary uploads).
const ALLOWED = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'font/',
  'application/font',
  'model/',
];

export function isAllowedMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return ALLOWED.some((a) => (a.endsWith('/') ? m.startsWith(a) : m === a));
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
