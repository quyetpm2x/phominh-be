import { ApiProperty } from '@nestjs/swagger';

// Hồ sơ cá nhân CHỈ hiện huy hiệu + tiến trình, không lộ điểm tuyệt đối (bussiness §4.2d) — kể cả
// cho chính chủ tài khoản xem hồ sơ mình.
export class UserProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() alias!: string;
  @ApiProperty({ required: false, nullable: true }) realName!: string | null;
  @ApiProperty() trustTier!: number;
  @ApiProperty() trustBadgeLabel!: string;
  @ApiProperty({
    description:
      'Điểm hữu ích còn thiếu để lên bậc tiếp theo, null nếu đã ở bậc cao nhất (bậc trọng số dừng ở 3, huy hiệu vẫn tăng tới 6)',
  })
  pointsToNextTier!: number | null;
  @ApiProperty() createdAt!: Date;
}
