import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Asset, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  ConfirmUploadDto,
  ListAssetsQueryDto,
  PresignDto,
  UpdateAssetDto,
  UploadMetaDto,
} from './dto/media.dto';
import { assetTypeFromMime, isAllowedMime } from './media.util';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Attach a resolvable public URL to an asset row. */
  private withUrl<T extends Asset>(asset: T) {
    return { ...asset, url: this.storage.urlFor(asset.storageKey) };
  }

  // ── Server-side multipart upload ─────────────────────────────────
  async upload(userId: string, file: UploadedFile, meta: UploadMetaDto) {
    if (!file) throw new BadRequestException('No file provided');
    if (!isAllowedMime(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const key = this.storage.newKey(userId, meta.name ?? file.originalname);
    await this.storage.putObject(key, file.buffer, file.mimetype);

    const asset = await this.prisma.asset.create({
      data: {
        ownerId: userId,
        type: assetTypeFromMime(file.mimetype),
        name: meta.name ?? file.originalname,
        storageKey: key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        width: meta.width,
        height: meta.height,
      },
    });
    await this.audit(userId, asset.id);
    return this.withUrl(asset);
  }

  // ── Presigned upload flow ────────────────────────────────────────
  async presign(userId: string, dto: PresignDto) {
    if (!isAllowedMime(dto.contentType)) {
      throw new BadRequestException(`Unsupported file type: ${dto.contentType}`);
    }
    const key = this.storage.newKey(userId, dto.filename);
    const uploadUrl = await this.storage.presignUpload(key, dto.contentType);
    return { key, uploadUrl };
  }

  async confirm(userId: string, dto: ConfirmUploadDto) {
    // Only allow confirming keys the user actually owns (owner-prefixed keys).
    if (!dto.key.startsWith(`${userId}/`)) {
      throw new ForbiddenException('Key does not belong to you');
    }
    const asset = await this.prisma.asset.create({
      data: {
        ownerId: userId,
        type: assetTypeFromMime(dto.mimeType),
        name: dto.name,
        storageKey: dto.key,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        width: dto.width,
        height: dto.height,
      },
    });
    await this.audit(userId, asset.id);
    return this.withUrl(asset);
  }

  // ── Read ─────────────────────────────────────────────────────────
  async list(userId: string, query: ListAssetsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 40;
    const where: Prisma.AssetWhereInput = {
      ownerId: userId,
      deletedAt: query.trashed ? { not: null } : null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.favorite ? { isFavorite: true } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      items: rows.map((a) => this.withUrl(a)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Update ───────────────────────────────────────────────────────
  async update(userId: string, id: string, dto: UpdateAssetDto) {
    await this.assertOwned(id, userId);
    const asset = await this.prisma.asset.update({
      where: { id },
      data: { name: dto.name, tags: dto.tags, isFavorite: dto.isFavorite },
    });
    return this.withUrl(asset);
  }

  // ── Delete lifecycle ─────────────────────────────────────────────
  async trash(userId: string, id: string) {
    await this.assertOwned(id, userId);
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, trashed: true };
  }

  async restore(userId: string, id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset || !asset.deletedAt) throw new NotFoundException('Trashed asset not found');
    if (asset.ownerId !== userId) throw new ForbiddenException('No access');
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: null } });
    return { id, trashed: false };
  }

  async remove(userId: string, id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.ownerId !== userId) throw new ForbiddenException('No access');
    await this.storage.deleteObject(asset.storageKey);
    await this.prisma.asset.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────
  private async assertOwned(id: string, userId: string): Promise<Asset> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.deletedAt) throw new NotFoundException('Asset not found');
    if (asset.ownerId !== userId) throw new ForbiddenException('No access to this asset');
    return asset;
  }

  private audit(userId: string, assetId: string) {
    return this.prisma.auditLog.create({
      data: { action: AuditAction.ASSET_UPLOADED, userId, targetType: 'Asset', targetId: assetId },
    });
  }
}
