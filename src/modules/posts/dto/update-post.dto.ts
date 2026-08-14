import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { HEX_COLOR_REGEX } from './create-post.dto';

// Chỉ cho sửa nội dung chữ + style (màu chữ/nền/cỡ chữ) — KHÔNG cho đổi ảnh/vị trí/loại bài, vì các
// trường đó gắn với xác thực chống giả mạo lúc đăng (EXIF, GPS accuracy — tai-lieu-chuc-nang.md
// #7c), đổi sau khi đăng sẽ phá vỡ giả định đó.
export class UpdatePostDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ description: 'Mã hex #RRGGBB, vd #FFFFFF' })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'textColor phải là mã hex dạng #RRGGBB' })
  textColor?: string;

  @ApiPropertyOptional({ description: 'Mã hex #RRGGBB, vd #1F6F52' })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'backgroundColor phải là mã hex dạng #RRGGBB' })
  backgroundColor?: string;

  @ApiPropertyOptional({ enum: ['small', 'medium', 'large'] })
  @IsOptional()
  @IsIn(['small', 'medium', 'large'])
  fontSize?: 'small' | 'medium' | 'large';
}
