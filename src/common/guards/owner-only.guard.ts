import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

// Chặn CHỈ admin có isOwner=true mới qua được — khác AdminPermissionGuard (quyền tuỳ chọn theo
// checkbox, Owner có thể cấp cho admin thường qua mục 111/112). Dùng cho route thật sự "chỉ Owner
// xem được" (bussiness §9.7 G8: chi phí vận hành) — không phải 1 quyền có thể cấp/thu hồi qua UI
// phân quyền thông thường. Chạy SAU AdminJwtAuthGuard (cần request.admin đã có sẵn).
@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.admin?.isOwner) {
      throw new ForbiddenException('Chỉ tài khoản Owner mới xem được mục này');
    }
    return true;
  }
}
