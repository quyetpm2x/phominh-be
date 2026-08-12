import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({
    example: '0912345678',
    description: 'SĐT dạng bất kỳ user gõ — validate/chuẩn hoá thật ở OtpService, không phải ở đây',
  })
  @IsString()
  @MinLength(9)
  @MaxLength(12)
  phone!: string;

  @ApiProperty({
    required: false,
    description: 'Token Cloudflare Turnstile — bắt buộc khi CAPTCHA_ENABLED=true (otp.service.ts)',
  })
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
