import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

import type { PermissionKey } from '../../../common/decorators/require-permission.decorator';

export class UpdateAdminPermissionsDto {
  // Thay THẲNG toàn bộ tập quyền hiện có bằng danh sách này — cùng cơ chế checkbox với lúc tạo
  // (CreateAdminDto), chỉ khác là SỬA thay vì tạo mới (tai-lieu-chuc-nang.md #112). Mảng rỗng =
  // thu hồi hết quyền, không xoá tài khoản.
  @ApiProperty({ type: [String] })
  @IsArray()
  permissionKeys!: PermissionKey[];
}
