import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class CreatePenaltyAppealDto {
  @ApiProperty()
  @IsUUID()
  trustScoreHistoryId!: string;

  @ApiProperty()
  @IsString()
  @Length(10, 500)
  explanation!: string;
}
