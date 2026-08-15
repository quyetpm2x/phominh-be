import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

// Form "Sắp có mặt tại khu vực của bạn" ở trang chủ web marketing (tai-lieu-chuc-nang.md #75).
export class PilotSignupDto {
  @ApiProperty()
  @IsString()
  phoneNumber!: string;
}
