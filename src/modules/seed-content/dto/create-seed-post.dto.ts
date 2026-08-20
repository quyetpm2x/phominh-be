import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSeedPostDto {
  @ApiProperty({ description: 'Đặt bài tại tâm toạ độ của khu vực thí điểm này' })
  @IsUUID()
  pilotAreaId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  content!: string;

  @ApiProperty({ enum: ['life', 'merchant', 'emergency'] })
  @IsIn(['life', 'merchant', 'emergency'])
  postType!: 'life' | 'merchant' | 'emergency';
}
