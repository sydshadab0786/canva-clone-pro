import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Can we make this @jane a bit bigger?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @ApiPropertyOptional({ description: 'Canvas anchor: { x, y } or { objectId }.' })
  @IsOptional()
  @IsObject()
  anchor?: Record<string, unknown>;
}
