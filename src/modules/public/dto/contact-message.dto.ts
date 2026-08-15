import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Form Liên hệ ở /contact (tai-lieu-chuc-nang.md #82) — contact là email HOẶC SĐT tự do, không ép
// định dạng cụ thể (user có thể để lại email hoặc SĐT tuỳ ý).
export class ContactMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  contact!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  message!: string;
}
