import { apiFetch } from '../api-client';

export interface ExportJob {
  id: string;
  projectId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  format: string;
  durationMs: number;
  frameCount: number;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
}

export function startExport(projectId: string, format = 'mp4'): Promise<ExportJob> {
  return apiFetch(`/projects/${projectId}/export`, { method: 'POST', body: { format } });
}

export function getExportStatus(jobId: string): Promise<ExportJob> {
  return apiFetch(`/export/${jobId}`, { method: 'GET' });
}
