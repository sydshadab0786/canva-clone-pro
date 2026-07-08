import { apiFetch } from '../api-client';
import type { Paginated, ProjectDetail } from './projects';

export interface TemplateCard {
  id: string;
  title: string;
  type: string;
  category: string;
  thumbnailUrl: string | null;
  width: number;
  height: number;
  isPremium: boolean;
  tags: string[];
  usageCount: number;
}

export function listTemplates(
  params: { type?: string; category?: string; search?: string; page?: number } = {},
): Promise<Paginated<TemplateCard>> {
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.category) q.set('category', params.category);
  if (params.search) q.set('search', params.search);
  if (params.page) q.set('page', String(params.page));
  const qs = q.toString();
  return apiFetch<Paginated<TemplateCard>>(`/templates${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export function listTemplateCategories(): Promise<{ category: string; count: number }[]> {
  return apiFetch(`/templates/categories`, { method: 'GET' });
}

/** Create a new design from a template; returns the new project. */
export function useTemplate(id: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/templates/${id}/use`, { method: 'POST' });
}
