import { ApiProperty } from '@nestjs/swagger';
import type { Gender } from '@prisma/client';

// Hồ sơ cá nhân CHỈ hiện huy hiệu + tiến trình, không lộ điểm tuyệt đối (bussiness §4.2d) — kể cả
// cho chính chủ tài khoản xem hồ sơ mình. realName/avatarUrl/dateOfBirth/gender null nghĩa là user
// CŨ chưa từng điền (bắt buộc lúc onboarding từ 2026-08-20 trở đi) — FE tự kiểm tra đủ 4 trường để
// quyết định chặn vào feed hay không (xem app/index.tsx phía mobile), backend không lưu cờ riêng.
export class UserProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() alias!: string;
  @ApiProperty({ required: false, nullable: true }) realName!: string | null;
  @ApiProperty({ required: false, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ required: false, nullable: true }) dateOfBirth!: Date | null;
  @ApiProperty({ required: false, nullable: true }) gender!: Gender | null;
  @ApiProperty() trustTier!: number;
  @ApiProperty() trustBadgeLabel!: string;
  @ApiProperty({
    description:
      'Điểm hữu ích còn thiếu để lên bậc tiếp theo, null nếu đã ở bậc cao nhất (bậc trọng số dừng ở 3, huy hiệu vẫn tăng tới 6)',
  })
  pointsToNextTier!: number | null;
  @ApiProperty() createdAt!: Date;
}
