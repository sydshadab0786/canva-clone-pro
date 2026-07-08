import { apiFetch } from '../api-client';
import type { Paginated } from './projects';

export interface Overview {
  users: number;
  projects: number;
  templates: number;
  assets: number;
  activeSubscriptions: number;
  mrrCents: number;
}
export interface DayBucket {
  date: string;
  count: number;
}
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
export interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
}
export interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  ipAddress: string | null;
  user: { email: string; displayName: string } | null;
}

export const adminOverview = () => apiFetch<Overview>('/admin/overview', { method: 'GET' });
export const adminSignups = (days = 30) => apiFetch<DayBucket[]>(`/admin/analytics/signups?days=${days}`, { method: 'GET' });
export const adminProjects = (days = 30) => apiFetch<DayBucket[]>(`/admin/analytics/projects?days=${days}`, { method: 'GET' });
export const adminTopTemplates = () => apiFetch<{ id: string; title: string; usageCount: number; category: string }[]>('/admin/analytics/top-templates', { method: 'GET' });
export const adminActivity = () => apiFetch<{ action: string; count: number }[]>('/admin/analytics/activity', { method: 'GET' });

export function adminUsers(params: { search?: string; role?: string; status?: string; page?: number } = {}): Promise<Paginated<AdminUser>> {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.role) q.set('role', params.role);
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  const qs = q.toString();
  return apiFetch(`/admin/users${qs ? `?${qs}` : ''}`, { method: 'GET' });
}

export const updateAdminUser = (id: string, data: { role?: string; status?: string }) =>
  apiFetch<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: data });

export const adminAuditLogs = (page = 1) => apiFetch<Paginated<AuditEntry>>(`/admin/audit-logs?page=${page}`, { method: 'GET' });
export const adminFeatureFlags = () => apiFetch<FeatureFlag[]>('/admin/feature-flags', { method: 'GET' });
export const upsertFeatureFlag = (flag: FeatureFlag) => apiFetch<FeatureFlag>('/admin/feature-flags', { method: 'PUT', body: flag });
