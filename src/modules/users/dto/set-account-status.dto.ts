import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Admin khoá/hạn chế/mở lại tài khoản (tai-lieu-chuc-nang.md #74, quyền manage_user_lock).
export class SetAccountStatusDto {
  @ApiProperty({ enum: ['active', 'banned', 'restricted'] })
  @IsIn(['active', 'banned', 'restricted'])
  status!: 'active' | 'banned' | 'restricted';

  @ApiPropertyOptional({ description: 'Lý do — hiện cho chính user xem (mục 74)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ description: 'Chỉ áp dụng khi status=restricted, ISO datetime' })
  @IsOptional()
  @IsDateString()
  restrictedUntil?: string;
}
