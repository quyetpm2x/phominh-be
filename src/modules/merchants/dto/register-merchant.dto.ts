import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterMerchantDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  businessName!: string;

  @ApiProperty()
  @IsString()
  addressText!: string;

  @ApiProperty()
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @IsLongitude()
  lng!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;
}
