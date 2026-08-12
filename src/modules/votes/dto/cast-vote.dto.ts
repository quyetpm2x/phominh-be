import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class CastVoteDto {
  @ApiProperty({ enum: ['post', 'comment'] })
  @IsIn(['post', 'comment'])
  targetType!: 'post' | 'comment';

  @ApiProperty()
  @IsUUID()
  targetId!: string;
}
