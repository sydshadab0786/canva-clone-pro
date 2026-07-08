import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCommentDto } from './dto/comments.dto';
import { parseMentions } from './mentions.util';

const AUTHOR_SELECT = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A user may access a project's comments if they own it, or it is shared
   * with their team, or it is link/public visible. (Team ACLs expand later.)
   */
  private async assertProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerId: true, visibility: true, teamId: true, deletedAt: true },
    });
    if (!project || project.deletedAt) throw new NotFoundException('Project not found');

    if (project.ownerId === userId) return project;
    if (project.visibility === 'PUBLIC' || project.visibility === 'LINK') return project;
    if (project.teamId) {
      const member = await this.prisma.teamMember.findFirst({
        where: { teamId: project.teamId, userId, status: 'ACTIVE' },
      });
      if (member) return project;
    }
    throw new ForbiddenException('No access to this project');
  }

  async list(userId: string, projectId: string) {
    await this.assertProjectAccess(projectId, userId);
    return this.prisma.comment.findMany({
      where: { projectId },
      include: { author: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, projectId: string, dto: CreateCommentDto) {
    await this.assertProjectAccess(projectId, userId);

    const comment = await this.prisma.comment.create({
      data: {
        projectId,
        authorId: userId,
        body: dto.body,
        anchor: (dto.anchor ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });

    await this.notifyMentions(dto.body, projectId, userId, comment.id);
    return comment;
  }

  /** Turn @usernames into notifications for real, distinct users (not self). */
  private async notifyMentions(body: string, projectId: string, authorId: string, commentId: string) {
    const usernames = parseMentions(body);
    if (usernames.length === 0) return;

    const users = await this.prisma.user.findMany({
      where: { username: { in: usernames }, id: { not: authorId } },
      select: { id: true },
    });
    if (users.length === 0) return;

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: 'MENTION',
        title: 'You were mentioned in a comment',
        data: { projectId, commentId } as Prisma.InputJsonValue,
      })),
    });
  }

  async resolve(userId: string, commentId: string, resolved: boolean) {
    const comment = await this.loadOwnedOrProjectOwner(commentId, userId);
    return this.prisma.comment.update({
      where: { id: comment.id },
      data: { resolvedAt: resolved ? new Date() : null },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async remove(userId: string, commentId: string) {
    const comment = await this.loadOwnedOrProjectOwner(commentId, userId);
    await this.prisma.comment.delete({ where: { id: comment.id } });
    return { id: comment.id, deleted: true };
  }

  /** The comment author or the project owner may resolve/delete a comment. */
  private async loadOwnedOrProjectOwner(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { project: { select: { ownerId: true } } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId && comment.project.ownerId !== userId) {
      throw new ForbiddenException('You cannot modify this comment');
    }
    return comment;
  }
}
