import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ enum: ['life', 'merchant', 'emergency'] })
  @IsIn(['life', 'merchant', 'emergency'])
  postType!: 'life' | 'merchant' | 'emergency';

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  content!: string;

  @ApiProperty({
    description: 'GPS THẬT lúc bấm đăng — không phải khu vực cố định (bussiness mục 2.1)',
  })
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ enum: ['alias', 'real_name'], default: 'alias' })
  @IsOptional()
  @IsIn(['alias', 'real_name'])
  displayMode?: 'alias' | 'real_name';

  @ApiPropertyOptional({
    description:
      'Chỉ true hợp lệ cho tài khoản merchant đã xác minh (bussiness §2.1) — moderation module xác nhận lại quyền này trước khi lưu, xem TODO trong posts.service.ts',
  })
  @IsOptional()
  @IsBoolean()
  isLibraryPhoto?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'URL ảnh đã upload lên Cloudflare R2 trước đó',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
