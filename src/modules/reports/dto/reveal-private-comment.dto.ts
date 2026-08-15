import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Bắt buộc ghi lý do TRƯỚC KHI xem nội dung bình luận riêng tư bị report (bussiness §9.9,
// tai-lieu-chuc-nang.md #88) — ghi vào SensitiveDataAccessLog.
export class RevealPrivateCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
