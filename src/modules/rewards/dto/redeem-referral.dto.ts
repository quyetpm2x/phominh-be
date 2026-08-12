import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RedeemReferralDto {
  @ApiProperty()
  @IsString()
  code!: string;
}
