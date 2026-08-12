import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import {
  REQUIRE_PERMISSION_KEY,
  type PermissionKey,
} from '../decorators/require-permission.decorator';

// Chạy SAU AdminJwtAuthGuard (@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)). Mô hình quyền
// tùy chọn theo checkbox, không phải vài "vai trò" cố định — Owner tự tích chọn permission cho
// từng admin (bussiness §9.9). Owner luôn có mọi quyền, không cần dòng nào trong
// admin_user_permissions.
@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<PermissionKey | undefined>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!required) return true; // route không gắn @RequirePermission — chỉ cần đăng nhập admin là đủ

    const request = context.switchToHttp().getRequest<Request>();
    const admin = request.admin;
    if (!admin) {
      throw new ForbiddenException(
        'Thiếu thông tin admin — kiểm tra thứ tự guard (AdminJwtAuthGuard trước)',
      );
    }
    if (admin.isOwner) return true;

    const grant = await this.prisma.adminUserPermission.findFirst({
      where: { adminUserId: admin.id, permission: { permissionKey: required } },
    });
    if (!grant) {
      throw new ForbiddenException(`Tài khoản admin thiếu quyền "${required}"`);
    }
    return true;
  }
}
