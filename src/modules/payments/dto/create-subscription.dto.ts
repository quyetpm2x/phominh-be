import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  planKey!: string;

  @ApiProperty()
  @IsInt()
  @Min(1000)
  amountVnd!: number;
}
