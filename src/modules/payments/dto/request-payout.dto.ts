import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsUUID, Min } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty()
  @IsUUID()
  bankAccountId!: string;

  @ApiProperty({ description: 'Bội số 50.000đ (bussiness §5.1e)' })
  @IsInt()
  @Min(50_000)
  amount!: number; // VND

  @ApiProperty({ enum: ['leaderboard', 'referral'] })
  @IsIn(['leaderboard', 'referral'])
  source!: 'leaderboard' | 'referral';
}
