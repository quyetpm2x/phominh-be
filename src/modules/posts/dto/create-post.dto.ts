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
  Matches,
  MaxLength,
} from 'class-validator';

// Chỉ nhận đúng #RRGGBB — chặn giá trị lạ lọt vào style CSS khi admin panel (web) render lại nội
// dung bài đăng (tránh CSS injection kiểu "red; background:url(...)").
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

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

  // Style áp dụng cho TOÀN BỘ nội dung (tai-lieu-chuc-nang.md #22) — giống Instagram/Threads Story
  // text tool, không phải rich text nhiều style/đoạn. null/không gửi = giao diện mặc định.
  @ApiPropertyOptional({ description: 'Mã hex #RRGGBB, vd #FFFFFF' })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'textColor phải là mã hex dạng #RRGGBB' })
  textColor?: string;

  @ApiPropertyOptional({ description: 'Mã hex #RRGGBB, vd #1F6F52' })
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'backgroundColor phải là mã hex dạng #RRGGBB' })
  backgroundColor?: string;

  @ApiPropertyOptional({ enum: ['small', 'medium', 'large'] })
  @IsOptional()
  @IsIn(['small', 'medium', 'large'])
  fontSize?: 'small' | 'medium' | 'large';

  // Chống giả mạo GPS (tai-lieu-chuc-nang.md #7a) — client tự báo cờ mocked location của thiết bị
  // (expo-location Location.mocked, chỉ đáng tin trên Android). Không gửi = coi như false (client
  // cũ chưa cập nhật vẫn đăng bài được, không phá luồng hiện tại).
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isMockLocation?: boolean;
}
