import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ example: 'WELCOME20' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}

export class ConsumeCreditsDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  amount!: number;
}
