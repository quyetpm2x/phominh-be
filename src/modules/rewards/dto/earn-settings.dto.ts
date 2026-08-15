import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

// 2 công tắc opt-in ĐỘC LẬP (bussiness §5.1a) — chỉ gửi field nào muốn đổi, field còn lại giữ nguyên.
export class UpdateEarnSettingsDto {
  @ApiPropertyOptional({ description: 'Công tắc 1 — Kiếm tiền qua bài viết (leaderboard)' })
  @IsOptional()
  @IsBoolean()
  earnViaPostsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Công tắc 2 — Chế độ Affiliate (mã giới thiệu có thưởng)' })
  @IsOptional()
  @IsBoolean()
  affiliateEnabled?: boolean;
}
