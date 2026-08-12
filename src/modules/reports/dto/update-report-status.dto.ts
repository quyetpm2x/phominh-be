import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsNumber, Max, Min } from 'class-validator';

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ['reviewed', 'actioned', 'dismissed'] })
  @IsIn(['reviewed', 'actioned', 'dismissed'])
  status!: 'reviewed' | 'actioned' | 'dismissed';

  // Chỉ áp dụng khi status='actioned' — admin xác nhận vi phạm mới ghi E2 (bussiness §4.2b),
  // report tự nó KHÔNG tự động trừ điểm.
  @ApiPropertyOptional({ enum: ['light', 'medium', 'severe'] })
  @IsOptional()
  @IsIn(['light', 'medium', 'severe'])
  severity?: 'light' | 'medium' | 'severe';

  @ApiPropertyOptional({
    description: 'Mức độ nghiêm trọng cụ thể trong khung severity, 0-1',
    default: 0.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  severityScore?: number;
}
