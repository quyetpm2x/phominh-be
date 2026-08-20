import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Bắt buộc ghi lý do TRƯỚC KHI xem chi tiết đầy đủ 1 người dùng (tai-lieu-chuc-nang.md #92, cùng
// pattern RevealPrivateCommentDto/#88) — ghi vào SensitiveDataAccessLog.
export class RevealUserDetailDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
