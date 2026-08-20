import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminPermissionsDto } from './dto/update-admin-permissions.dto';

// Ngưỡng chặt hơn mức global (app.module.ts: 120/phút) — chặn brute-force mật khẩu đăng nhập
// admin, cùng mức đang áp dụng cho OTP mobile (auth.controller.ts).
const ADMIN_LOGIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('admin')
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Xác thực riêng biệt, không dùng chung OTP Supabase (bussiness §9.1 A1) — route công khai.
  @Post('auth/login')
  @Throttle(ADMIN_LOGIN_THROTTLE)
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  // Hồ sơ của chính admin đang đăng nhập — mọi admin đã xác thực đều xem được, không cần
  // permission riêng.
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @Get('me')
  getMe(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminService.getMe(admin.id);
  }

  // Tự đổi mật khẩu bản thân — không cần permission 'manage_admins' (khác updatePermissions bên
  // dưới, vốn để Owner sửa quyền của admin KHÁC).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @Patch('me/password')
  changePassword(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: ChangeAdminPasswordDto) {
    return this.adminService.changePassword(admin.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_admins')
  @Post('admins')
  createAdmin(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto, admin.id);
  }

  // Nhóm H (tai-lieu-chuc-nang.md #113).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_admins')
  @Get('admins')
  listAdmins() {
    return this.adminService.listAdmins();
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @Get('permissions')
  listPermissions() {
    return this.adminService.listPermissions();
  }

  // Sửa/thu hồi quyền admin đã cấp (tai-lieu-chuc-nang.md #112).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_admins')
  @Patch('admins/:id/permissions')
  updatePermissions(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: UpdateAdminPermissionsDto,
  ) {
    return this.adminService.updatePermissions(id, dto, admin.id);
  }
}
