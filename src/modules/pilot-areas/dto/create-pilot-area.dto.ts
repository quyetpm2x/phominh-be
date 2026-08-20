import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class CreatePilotAreaDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @IsLongitude()
  lng!: number;

  @ApiProperty({ description: 'km, mặc định 2 nếu không truyền' })
  @IsNumber()
  @Min(0.5)
  @Max(20)
  radiusKm!: number;
}
