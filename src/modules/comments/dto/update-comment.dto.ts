import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  content!: string;
}
