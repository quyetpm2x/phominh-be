import { ApiPropertyOptional } from '@nestjs/swagger';
import type { Gender } from '@prisma/client';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const GENDER_VALUES: Gender[] = ['male', 'female', 'other'];

// Field nào cũng optional ở tầng DTO (cho phép sửa từng phần từ màn chỉnh sửa hồ sơ) — màn
// onboarding (personal-info.tsx) mới là nơi bắt buộc đủ cả 4 trường trước khi cho submit.
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Tên thật — bắt buộc điền lúc onboarding, sửa được sau đó' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  realName?: string;

  @ApiPropertyOptional({ description: 'Ngày sinh, định dạng ISO (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: GENDER_VALUES })
  @IsOptional()
  @IsIn(GENDER_VALUES)
  gender?: Gender;
}
