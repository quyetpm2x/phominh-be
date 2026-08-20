import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SetKpiTargetDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  postsTarget!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  votesTarget!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  commentsTarget!: number;
}
