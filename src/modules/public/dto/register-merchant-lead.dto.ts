import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Form "Đăng ký cho quán mình" ở web marketing /merchant — CHỈ 3 trường (tai-lieu-chuc-nang.md
// #77) — KHÁC hẳn đăng ký merchant thật trong app (mục 39, có GPS, tự động duyệt). Đây chỉ là lead
// để đội vận hành gọi lại, chưa tạo tài khoản/hồ sơ quán nào.
export class RegisterMerchantLeadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  businessName!: string;

  @ApiProperty()
  @IsString()
  phoneNumber!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  address!: string;
}
