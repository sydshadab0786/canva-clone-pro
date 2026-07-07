import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

// Never leak secret columns to the API surface.
const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  role: true,
  status: true,
  locale: true,
  twoFactorEnabled: true,
  emailVerifiedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(
    id: string,
    data: { displayName?: string; username?: string; avatarUrl?: string; locale?: string },
  ) {
    return this.prisma.user.update({ where: { id }, data, select: PUBLIC_USER_SELECT });
  }

  /** List a user's active refresh sessions for the "logged-in devices" screen. */
  async listSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        deviceName: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
  }
}
