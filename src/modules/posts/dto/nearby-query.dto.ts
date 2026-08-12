import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class NearbyQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ default: 2, description: 'km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(10)
  radiusKm?: number;

  @ApiPropertyOptional({ enum: ['life', 'merchant', 'emergency'] })
  @IsOptional()
  @IsIn(['life', 'merchant', 'emergency'])
  postType?: 'life' | 'merchant' | 'emergency';
}
