import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsLatitude, IsLongitude, IsNumber, IsString, Max, Min } from 'class-validator';

export class SetFixedAreaDto {
  @ApiProperty({ enum: ['home', 'work'] })
  @IsIn(['home', 'work'])
  label!: 'home' | 'work';

  @ApiProperty()
  @IsString()
  addressText!: string;

  @ApiProperty()
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @IsLongitude()
  lng!: number;

  @ApiProperty({ description: 'km — nội đô Hà Nội hợp 1-4km (bussiness §7C)' })
  @IsNumber()
  @Min(0.5)
  @Max(10)
  radiusKm!: number;
}
