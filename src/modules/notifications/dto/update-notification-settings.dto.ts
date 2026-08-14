import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateNotificationSettingsDto {
  // Mặc định 1 lần/tuần — gom lại theo đợt, tránh báo ngay từng tin gây phiền (bussiness §2.1).
  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'emergency_only'] })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'emergency_only'])
  frequency?: 'daily' | 'weekly' | 'emergency_only';

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiPropertyOptional({ example: '07:00' })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;

  // "Loại thông báo" (tai-lieu-chuc-nang.md #48) — độc lập với frequency.
  @ApiPropertyOptional({ description: 'Nhận thông báo khi có bình luận mới trên bài của mình' })
  @IsOptional()
  @IsBoolean()
  notifyComments?: boolean;
}
