import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Bắt buộc ghi lý do TRƯỚC KHI admin ẩn bình luận bất kỳ (mục 120) — cùng pattern
// RevealPrivateCommentDto/#88, ghi vào AdminActionLog.metadata.
export class HideCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
