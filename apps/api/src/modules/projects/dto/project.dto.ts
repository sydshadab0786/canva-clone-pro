import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType, ProjectVisibility } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @ApiPropertyOptional({ example: 'Untitled design' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: ProjectType })
  @IsOptional()
  @IsEnum(ProjectType)
  type?: ProjectType;

  @ApiProperty({ example: 1080, description: 'Canvas width in px.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  width!: number;

  @ApiProperty({ example: 1080, description: 'Canvas height in px.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  height!: number;

  @ApiPropertyOptional({ description: 'Initial scene document (JSON).' })
  @IsOptional()
  @IsObject()
  document?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: ProjectVisibility })
  @IsOptional()
  @IsEnum(ProjectVisibility)
  visibility?: ProjectVisibility;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  folderId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

export class SaveDocumentDto {
  @ApiProperty({ description: 'Full scene document (JSON) to persist.' })
  @IsObject()
  document!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Optional thumbnail (data URL or storage URL).' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Also store a named version snapshot.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  versionLabel?: string;
}

export class ListProjectsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiPropertyOptional({ enum: ProjectType })
  @IsOptional()
  @IsEnum(ProjectType)
  type?: ProjectType;

  @ApiPropertyOptional({ description: 'Only favorites when true.' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  favorite?: boolean;

  @ApiPropertyOptional({ description: 'Return trashed (soft-deleted) projects.' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  trashed?: boolean;

  @ApiPropertyOptional({ description: 'Case-insensitive title search.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
