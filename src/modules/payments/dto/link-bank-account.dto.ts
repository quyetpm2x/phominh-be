import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class LinkBankAccountDto {
  @ApiProperty()
  @IsString()
  bankCode!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  accountNumber!: string;

  @ApiProperty()
  @IsString()
  accountHolderName!: string;
}
