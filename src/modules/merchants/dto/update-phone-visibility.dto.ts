import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePhoneVisibilityDto {
  @ApiProperty({ enum: ['always', 'business_hours', 'hidden'] })
  @IsIn(['always', 'business_hours', 'hidden'])
  phoneVisibility!: 'always' | 'business_hours' | 'hidden';

  @ApiPropertyOptional({ example: '06:00' })
  @IsOptional()
  @IsString()
  businessHoursStart?: string;

  @ApiPropertyOptional({ example: '21:00' })
  @IsOptional()
  @IsString()
  businessHoursEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  zaloEnabled?: boolean;
}
