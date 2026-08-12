import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsUUID, Min } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty()
  @IsUUID()
  bankAccountId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1000)
  amount!: number; // VND

  @ApiProperty({ enum: ['leaderboard', 'referral'] })
  @IsIn(['leaderboard', 'referral'])
  source!: 'leaderboard' | 'referral';
}
