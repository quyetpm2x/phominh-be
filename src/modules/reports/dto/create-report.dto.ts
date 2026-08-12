import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ['post', 'comment', 'merchant_suspicious'] })
  @IsIn(['post', 'comment', 'merchant_suspicious'])
  targetType!: 'post' | 'comment' | 'merchant_suspicious';

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
