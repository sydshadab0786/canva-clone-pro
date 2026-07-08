import { apiFetch } from '../api-client';
import type { SceneDocument } from '@/lib/editor/types';

export interface ProjectSummary {
  id: string;
  title: string;
  type: string;
  width: number;
  height: number;
  thumbnailUrl: string | null;
  isFavorite: boolean;
  folderId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  document: SceneDocument;
  visibility: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function listProjects(params: {
  favorite?: boolean;
  trashed?: boolean;
  search?: string;
  page?: number;
} = {}): Promise<Paginated<ProjectSummary>> {
  const q = new URLSearchParams();
  if (params.favorite) q.set('favorite', 'true');
  if (params.trashed) q.set('trashed', 'true');
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', String(params.page));
  const qs = q.toString();
  return apiFetch<Paginated<ProjectSummary>>(`/projects${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export function createProject(input: {
  title?: string;
  type?: string;
  width: number;
  height: number;
  document?: SceneDocument;
}): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>('/projects', { method: 'POST', body: input });
}

export function getProject(id: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/projects/${id}`, { method: 'GET' });
}

export function saveDocument(
  id: string,
  document: SceneDocument,
  opts: { thumbnailUrl?: string; versionLabel?: string } = {},
): Promise<{ id: string; updatedAt: string }> {
  return apiFetch(`/projects/${id}/document`, {
    method: 'PUT',
    body: { document, ...opts },
  });
}

export function renameProject(id: string, title: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/projects/${id}`, { method: 'PATCH', body: { title } });
}
