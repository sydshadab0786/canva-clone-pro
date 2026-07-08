import { apiFetch } from '../api-client';
import type { Paginated } from './projects';

export interface Asset {
  id: string;
  type: string;
  name: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  url: string;
}

/** Measure an image file's intrinsic dimensions before upload (best-effort). */
async function measure(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/')) return {};
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

export async function uploadAsset(file: File): Promise<Asset> {
  const { width, height } = await measure(file);
  const form = new FormData();
  form.append('file', file);
  form.append('name', file.name);
  if (width) form.append('width', String(width));
  if (height) form.append('height', String(height));
  return apiFetch<Asset>('/media/upload', { method: 'POST', body: form });
}

export function listAssets(params: { type?: string; search?: string; page?: number } = {}): Promise<
  Paginated<Asset>
> {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', String(params.page));
  const qs = q.toString();
  return apiFetch<Paginated<Asset>>(`/media${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export function deleteAsset(id: string): Promise<{ id: string; trashed: boolean }> {
  return apiFetch(`/media/${id}`, { method: 'DELETE' });
}

export function toggleFavoriteAsset(id: string, isFavorite: boolean): Promise<Asset> {
  return apiFetch<Asset>(`/media/${id}`, { method: 'PATCH', body: { isFavorite } });
}
