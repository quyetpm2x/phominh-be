import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetLeadHandledDto {
  @ApiProperty({ description: 'true = đánh dấu đã liên hệ lại, false = bỏ đánh dấu' })
  @IsBoolean()
  handled!: boolean;
}
