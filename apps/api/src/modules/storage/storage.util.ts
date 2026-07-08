import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';

/**
 * Pure helpers for object-storage keys. Kept separate from the AWS SDK so they
 * are trivially unit-testable and free of side effects.
 */

/** Strip anything that isn't safe in a URL/key, collapse whitespace. */
export function sanitizeFilename(name: string): string {
  const rawExt = extname(name);
  let ext = rawExt.toLowerCase().replace(/[^a-z0-9.]/g, '');
  // A bare '.' (e.g. from '....') is not a real extension.
  if (ext === '.') ext = '';
  const base = name
    .slice(0, name.length - rawExt.length)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'file'}${ext}`;
}

/**
 * Build a collision-resistant, tenant-scoped storage key:
 *   {ownerId}/{yyyy}/{mm}/{random}-{safe-name}
 * Owner-prefixing makes per-user listing/cleanup and access rules simple.
 */
export function buildStorageKey(ownerId: string, filename: string, now = new Date()): string {
  const safe = sanitizeFilename(filename);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const rand = randomBytes(8).toString('hex');
  return `${ownerId}/${yyyy}/${mm}/${rand}-${safe}`;
}

/** Public URL for an object given the configured public base. */
export function publicUrl(publicBaseUrl: string, key: string): string {
  return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
}
