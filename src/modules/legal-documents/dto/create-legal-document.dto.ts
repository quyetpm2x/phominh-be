import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateLegalDocumentDto {
  @ApiProperty({ enum: ['terms', 'privacy'] })
  @IsIn(['terms', 'privacy'])
  docType!: 'terms' | 'privacy';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  version!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;
}
