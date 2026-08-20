import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetPilotAreaActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
