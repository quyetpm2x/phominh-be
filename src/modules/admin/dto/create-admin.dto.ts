import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsString, MinLength } from 'class-validator';

import type { PermissionKey } from '../../../common/decorators/require-permission.decorator';

export class CreateAdminDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  // Owner tự tích chọn từng quyền cụ thể — không phải vài "vai trò" cố định (bussiness §9.9).
  @ApiProperty({ type: [String] })
  @IsArray()
  permissionKeys!: PermissionKey[];
}
