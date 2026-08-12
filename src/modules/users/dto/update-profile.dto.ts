import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Không bắt buộc tên thật — user tự đặt (bussiness §4.3)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  realName?: string;
}
