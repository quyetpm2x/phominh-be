import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsLatitude, IsLongitude, IsOptional } from 'class-validator';

// GPS THẬT lúc bấm xác nhận — bắt buộc, dùng để kiểm tra "trong bán kính nhỏ" quanh bài
// (tai-lieu-chuc-nang.md #7e, bussiness §3).
export class ConfirmEmergencyDto {
  @ApiProperty()
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMockLocation?: boolean;
}
