import { apiFetch } from '../api-client';

export interface SearchResult {
  kind: 'project' | 'template';
  id: string;
  title: string;
  type: string;
  thumbnailUrl: string | null;
}

export interface SearchResponse {
  query: string;
  engine: 'elasticsearch' | 'postgres';
  results: SearchResult[];
}

export function globalSearch(q: string, kinds?: ('project' | 'template')[]): Promise<SearchResponse> {
  const params = new URLSearchParams({ q });
  if (kinds?.length) params.set('kinds', kinds.join(','));
  return apiFetch<SearchResponse>(`/search?${params.toString()}`, { method: 'GET' });
}
