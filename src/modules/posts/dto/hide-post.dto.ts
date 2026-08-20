import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Bắt buộc ghi lý do TRƯỚC KHI ẩn bài đăng (mục 120) — cùng pattern RevealPrivateCommentDto/#88,
// ghi vào AdminActionLog.metadata thay vì SensitiveDataAccessLog (đây là hành động THAY ĐỔI dữ
// liệu, không phải truy cập/xem nội dung nhạy cảm).
export class HidePostDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
