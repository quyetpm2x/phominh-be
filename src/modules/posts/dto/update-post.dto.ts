import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

// Chỉ cho sửa nội dung chữ — KHÔNG cho đổi ảnh/vị trí/loại bài, vì các trường đó gắn với xác thực
// chống giả mạo lúc đăng (EXIF, GPS accuracy — tai-lieu-chuc-nang.md #7c), đổi sau khi đăng sẽ phá vỡ
// giả định đó.
export class UpdatePostDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  content!: string;
}
