import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MarkCollaboratorDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;
}
