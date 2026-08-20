import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Khung giờ hiện SĐT/Zalo cho 1 ngày trong tuần (tai-lieu-chuc-nang.md #43) — thay 2 field phẳng
// businessHoursStart/End cũ (1 khung áp dụng mọi ngày) bằng mảng, mỗi phần tử 1 ngày. Ngày nào
// KHÔNG gửi trong mảng = merchant chưa cấu hình ngày đó, coi như ẨN số ngày đó.
export class MerchantBusinessHourInputDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Chủ nhật .. 6=Thứ Bảy (Date.getDay())' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(HHMM_PATTERN, { message: 'startTime phải theo định dạng HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '20:00' })
  @IsString()
  @Matches(HHMM_PATTERN, { message: 'endTime phải theo định dạng HH:mm' })
  endTime!: string;
}

export class UpdatePhoneVisibilityDto {
  @ApiProperty({ enum: ['always', 'business_hours', 'hidden'] })
  @IsIn(['always', 'business_hours', 'hidden'])
  phoneVisibility!: 'always' | 'business_hours' | 'hidden';

  @ApiPropertyOptional({
    type: [MerchantBusinessHourInputDto],
    description:
      'Chỉ cần khi phoneVisibility=business_hours — thay TOÀN BỘ lịch cũ bằng mảng này (không phải patch từng ngày). Gửi mảng rỗng để xoá hết.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MerchantBusinessHourInputDto)
  businessHours?: MerchantBusinessHourInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  zaloEnabled?: boolean;
}
