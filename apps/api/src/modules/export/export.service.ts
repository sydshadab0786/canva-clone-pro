import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildRenderPlan, type RenderPlan } from './render-plan.util';

export type ExportStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  projectId: string;
  ownerId: string;
  status: ExportStatus;
  progress: number; // 0..100
  format: string;
  durationMs: number;
  frameCount: number;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
}

/**
 * Orchestrates MP4 export. Building the deterministic render plan from the
 * timeline is real; the frame compositing itself belongs in a dedicated worker
 * (ffmpeg / headless renderer) fed off a queue. Here we run the plan and
 * simulate the worker's progress so the full request→poll→download UX works
 * end-to-end. Swapping in a real renderer is contained to `runRender`.
 */
@Injectable()
export class ExportService {
  private readonly jobs = new Map<string, ExportJob>();
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.publicBaseUrl = config.get('storage', { infer: true }).publicBaseUrl;
  }

  async start(userId: string, projectId: string, format = 'mp4'): Promise<ExportJob> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException('No access to this project');

    let plan: RenderPlan;
    try {
      plan = buildRenderPlan(project.document as unknown as Parameters<typeof buildRenderPlan>[0]);
    } catch {
      throw new NotFoundException('Project has no renderable timeline');
    }

    const job: ExportJob = {
      id: randomUUID(),
      projectId,
      ownerId: userId,
      status: 'queued',
      progress: 0,
      format,
      durationMs: plan.durationMs,
      frameCount: plan.frameCount,
      resultUrl: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    this.runRender(job);
    return job;
  }

  get(userId: string, jobId: string): ExportJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException('Export job not found');
    if (job.ownerId !== userId) throw new ForbiddenException('No access to this job');
    return job;
  }

  /**
   * Simulated render loop. A real implementation would stream `plan.segments`
   * through ffmpeg and upload the result to object storage; the progress model
   * and the completion contract (status + resultUrl) stay identical.
   */
  private runRender(job: ExportJob): void {
    job.status = 'processing';
    // ~2.4s total: 6 ticks of 400ms. Empty timelines complete immediately.
    if (job.frameCount === 0) {
      job.status = 'failed';
      job.error = 'Nothing to export — the timeline is empty.';
      job.progress = 0;
      return;
    }
    const timer = setInterval(() => {
      job.progress = Math.min(100, job.progress + 17);
      if (job.progress >= 100) {
        clearInterval(timer);
        job.progress = 100;
        job.status = 'completed';
        job.resultUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/exports/${job.id}.${job.format}`;
      }
    }, 400);
    // Do not keep the event loop alive solely for the simulation.
    if (typeof timer.unref === 'function') timer.unref();
  }
}
