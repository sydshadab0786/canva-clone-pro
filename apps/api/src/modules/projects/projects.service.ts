import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, ProjectType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateProjectDto,
  ListProjectsQueryDto,
  SaveDocumentDto,
  UpdateProjectDto,
} from './dto/project.dto';

// Keep list payloads light — never ship the full document in a list.
const LIST_SELECT = {
  id: true,
  title: true,
  type: true,
  visibility: true,
  width: true,
  height: true,
  thumbnailUrl: true,
  isFavorite: true,
  folderId: true,
  updatedAt: true,
  createdAt: true,
} satisfies Prisma.ProjectSelect;

// Snapshot the document into a version at most once per this interval during
// autosave, so rapid saves don't create thousands of version rows.
const VERSION_THROTTLE_MS = 5 * 60 * 1000;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Load a project the user owns, or throw. Central authorization choke-point. */
  private async assertOwned(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project || project.deletedAt) {
      // A trashed project is "not found" for normal reads; trash ops use findTrashed.
      throw new NotFoundException('Project not found');
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }
    return project;
  }

  private audit(action: AuditAction, userId: string, projectId: string) {
    return this.prisma.auditLog.create({
      data: { action, userId, targetType: 'Project', targetId: projectId },
    });
  }

  // ── Create ───────────────────────────────────────────────────────

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        ownerId: userId,
        title: dto.title ?? 'Untitled design',
        type: dto.type ?? ProjectType.CUSTOM,
        width: dto.width,
        height: dto.height,
        folderId: dto.folderId,
        templateId: dto.templateId,
        document: (dto.document ?? { version: 1, objects: [] }) as Prisma.InputJsonValue,
      },
    });
    await this.audit(AuditAction.PROJECT_CREATED, userId, project.id);
    return project;
  }

  // ── Read ─────────────────────────────────────────────────────────

  async list(userId: string, query: ListProjectsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 24;

    const where: Prisma.ProjectWhereInput = {
      ownerId: userId,
      deletedAt: query.trashed ? { not: null } : null,
      ...(query.folderId ? { folderId: query.folderId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.favorite ? { isFavorite: true } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(userId: string, id: string) {
    return this.assertOwned(id, userId);
  }

  // ── Update metadata ──────────────────────────────────────────────

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    await this.assertOwned(id, userId);
    return this.prisma.project.update({
      where: { id },
      data: {
        title: dto.title,
        visibility: dto.visibility,
        folderId: dto.folderId,
        isFavorite: dto.isFavorite,
        thumbnailUrl: dto.thumbnailUrl,
      },
    });
  }

  // ── Autosave document ────────────────────────────────────────────

  async saveDocument(userId: string, id: string, dto: SaveDocumentDto) {
    await this.assertOwned(id, userId);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        document: dto.document as Prisma.InputJsonValue,
        thumbnailUrl: dto.thumbnailUrl,
      },
      select: { id: true, updatedAt: true },
    });

    // Create a version snapshot when explicitly labelled, or when the last
    // snapshot is older than the throttle window (time-machine autosave).
    const shouldSnapshot =
      !!dto.versionLabel || (await this.isVersionDue(id));
    if (shouldSnapshot) {
      await this.prisma.projectVersion.create({
        data: {
          projectId: id,
          authorId: userId,
          document: dto.document as Prisma.InputJsonValue,
          label: dto.versionLabel,
        },
      });
    }

    return updated;
  }

  private async isVersionDue(projectId: string): Promise<boolean> {
    const last = await this.prisma.projectVersion.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!last) return true;
    return Date.now() - last.createdAt.getTime() > VERSION_THROTTLE_MS;
  }

  // ── Versions ─────────────────────────────────────────────────────

  async listVersions(userId: string, id: string) {
    await this.assertOwned(id, userId);
    return this.prisma.projectVersion.findMany({
      where: { projectId: id },
      select: { id: true, label: true, authorId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async restoreVersion(userId: string, id: string, versionId: string) {
    await this.assertOwned(id, userId);
    const version = await this.prisma.projectVersion.findFirst({
      where: { id: versionId, projectId: id },
    });
    if (!version) throw new NotFoundException('Version not found');

    return this.prisma.project.update({
      where: { id },
      data: { document: version.document as Prisma.InputJsonValue },
    });
  }

  // ── Duplicate ────────────────────────────────────────────────────

  async duplicate(userId: string, id: string) {
    const source = await this.assertOwned(id, userId);
    return this.prisma.project.create({
      data: {
        ownerId: userId,
        title: `${source.title} (copy)`,
        type: source.type,
        width: source.width,
        height: source.height,
        folderId: source.folderId,
        document: source.document as Prisma.InputJsonValue,
        thumbnailUrl: source.thumbnailUrl,
      },
    });
  }

  // ── Trash lifecycle ──────────────────────────────────────────────

  async trash(userId: string, id: string) {
    await this.assertOwned(id, userId);
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit(AuditAction.PROJECT_DELETED, userId, id);
    return { id, trashed: true };
  }

  async restore(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project || !project.deletedAt) throw new NotFoundException('Trashed project not found');
    if (project.ownerId !== userId) throw new ForbiddenException('No access');
    await this.prisma.project.update({ where: { id }, data: { deletedAt: null } });
    return { id, trashed: false };
  }

  async remove(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) throw new ForbiddenException('No access');
    await this.prisma.project.delete({ where: { id } });
    return { id, deleted: true };
  }
}
