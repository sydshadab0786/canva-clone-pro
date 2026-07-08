import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class WriteCopyDto {
  @ApiProperty({ example: 'a launch post for our new productivity app' })
  @IsString()
  @MaxLength(1000)
  prompt!: string;

  @ApiPropertyOptional({ enum: ['neutral', 'playful', 'bold', 'professional'] })
  @IsOptional()
  @IsIn(['neutral', 'playful', 'bold', 'professional'])
  tone?: string;
}

export class RewriteDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  text!: string;

  @ApiProperty({ enum: ['shorten', 'expand', 'formal', 'friendly', 'fix'] })
  @IsIn(['shorten', 'expand', 'formal', 'friendly', 'fix'])
  mode!: 'shorten' | 'expand' | 'formal' | 'friendly' | 'fix';
}

export class TranslateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  text!: string;

  @ApiProperty({ example: 'es', description: 'Target language code or name.' })
  @IsString()
  @MaxLength(20)
  target!: string;
}

export class PaletteDto {
  @ApiProperty({ example: 'calm ocean sunrise' })
  @IsString()
  @MaxLength(200)
  prompt!: string;

  @ApiPropertyOptional({ enum: ['analogous', 'complementary', 'triadic'] })
  @IsOptional()
  @IsIn(['analogous', 'complementary', 'triadic'])
  harmony?: 'analogous' | 'complementary' | 'triadic';
}

export class FontRecoDto {
  @ApiProperty({ example: 'wedding invitation' })
  @IsString()
  @MaxLength(200)
  keyword!: string;
}

export class SceneDto {
  @ApiProperty({ description: 'The scene document to analyze.' })
  @IsObject()
  scene!: Record<string, unknown>;
}

export class GenerateImageDto {
  @ApiProperty({ example: 'a neon cyberpunk city skyline at night' })
  @IsString()
  @MaxLength(1000)
  prompt!: string;

  @ApiPropertyOptional({ default: 1024 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(64)
  @Max(2048)
  width?: number;

  @ApiPropertyOptional({ default: 1024 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(64)
  @Max(2048)
  height?: number;
}
