import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';

@ApiTags('admin')
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Xác thực riêng biệt, không dùng chung OTP Supabase (bussiness §9.1 A1) — route công khai.
  @Post('auth/login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
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
}
