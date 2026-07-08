import { apiFetch } from '../api-client';

export interface CommentAuthor {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  projectId: string;
  authorId: string;
  body: string;
  anchor: Record<string, unknown> | null;
  resolvedAt: string | null;
  createdAt: string;
  author: CommentAuthor;
}

export function listComments(projectId: string): Promise<Comment[]> {
  return apiFetch(`/projects/${projectId}/comments`, { method: 'GET' });
}

export function addComment(
  projectId: string,
  body: string,
  anchor?: Record<string, unknown>,
): Promise<Comment> {
  return apiFetch(`/projects/${projectId}/comments`, { method: 'POST', body: { body, anchor } });
}

export function resolveComment(id: string, resolved: boolean): Promise<Comment> {
  return apiFetch(`/comments/${id}/${resolved ? 'resolve' : 'reopen'}`, { method: 'PATCH' });
}

export function deleteComment(id: string): Promise<{ id: string; deleted: boolean }> {
  return apiFetch(`/comments/${id}`, { method: 'DELETE' });
}
