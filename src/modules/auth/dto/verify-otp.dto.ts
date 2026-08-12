import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '0912345678' })
  @IsString()
  @MinLength(9)
  @MaxLength(12)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp!: string;
}
