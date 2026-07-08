import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../common/config/configuration';
import { buildStorageKey, publicUrl } from './storage.util';

export interface PutResult {
  key: string;
  url: string;
}

/**
 * S3-compatible object storage (works against AWS S3 or MinIO). Exposes both a
 * server-side upload path (used by the media controller's multipart endpoint)
 * and a presigned-URL path (for large/direct browser uploads).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly cfg: AppConfig['storage'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.cfg = config.get('storage', { infer: true });
    this.client = new S3Client({
      region: this.cfg.region,
      endpoint: this.cfg.endpoint,
      forcePathStyle: this.cfg.forcePathStyle,
      credentials: {
        accessKeyId: this.cfg.accessKey,
        secretAccessKey: this.cfg.secretKey,
      },
    });
  }

  newKey(ownerId: string, filename: string): string {
    return buildStorageKey(ownerId, filename);
  }

  urlFor(key: string): string {
    return publicUrl(this.cfg.publicBaseUrl, key);
  }

  /** Upload bytes directly from the API process (multipart endpoint). */
  async putObject(key: string, body: Buffer, contentType: string): Promise<PutResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key, url: this.urlFor(key) };
  }

  /** Presigned PUT so the browser can upload straight to storage. */
  async presignUpload(key: string, contentType: string, expiresIn = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    } catch (err) {
      // Deleting storage is best-effort; a missing object shouldn't block the DB op.
      this.logger.warn(`Failed to delete object ${key}: ${(err as Error).message}`);
    }
  }
}
