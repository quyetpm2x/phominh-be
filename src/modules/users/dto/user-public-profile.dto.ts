import { ApiProperty } from '@nestjs/swagger';

// Hồ sơ CÔNG KHAI của người khác (tai-lieu-chuc-nang.md #36) — KHÔNG trả realName (chỉ hiện qua
// displayMode của từng bài, không phải thuộc tính public của cả hồ sơ — cùng nguyên tắc với
// PostsService.toBaseSummary tránh lộ tên thật ngoài ý muốn).
export class UserPublicProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() alias!: string;
  @ApiProperty({ required: false, nullable: true }) avatarUrl!: string | null;
  @ApiProperty() trustBadgeLabel!: string;
  @ApiProperty() postCount!: number;
  @ApiProperty() createdAt!: Date;
  // Chỉ có giá trị nếu tài khoản này là merchant — cho FE biết có thể gửi report
  // targetType='merchant_suspicious' (tai-lieu-chuc-nang.md #31) hay không, và dùng ID nào.
  @ApiProperty({ required: false, nullable: true }) merchantId!: string | null;
}
