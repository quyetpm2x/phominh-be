import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { AccountLifecycleService } from './account-lifecycle.service';
import { AdminUserQueriesService } from './admin-user-queries.service';
import { RevealUserDetailDto } from './dto/reveal-user-detail.dto';
import { SetAccountStatusDto } from './dto/set-account-status.dto';

// Tách khỏi UsersController (đã gần giới hạn 250 dòng) — điều khoản (#67), khoá/hạn chế (#74), yêu
// cầu xoá tài khoản (#69/#73), danh sách/chi tiết user cho admin (#91/#92). Controller
// '@Controller(\'api\')' (không phải 'api/mobile/users') vì mixed mobile + admin route, cùng pattern
// reports.controller.ts/payments.controller.ts.
@ApiTags('users')
@Controller('api')
export class AccountLifecycleController {
  constructor(
    private readonly accountLifecycle: AccountLifecycleService,
    private readonly adminUserQueries: AdminUserQueriesService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/users/me/terms-acceptance')
  acceptTerms(@CurrentUser() user: AuthenticatedUser) {
    return this.accountLifecycle.acceptTerms(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mobile/users/me/terms-acceptance')
  getTermsStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.accountLifecycle.getTermsStatus(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mobile/users/me/account-status')
  getAccountStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.accountLifecycle.getAccountStatus(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/users/me/deletion-request')
  requestDeletion(@CurrentUser() user: AuthenticatedUser) {
    return this.accountLifecycle.requestDeletion(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mobile/users/me/deletion-request')
  getDeletionStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.accountLifecycle.getDeletionStatus(user.id);
  }

  // Tra cứu trước khi khoá (tai-lieu-chuc-nang.md #95) — admin nhập SĐT hoặc mã tài khoản (UUID) để
  // tìm đúng người trước khi bấm khoá/mở khoá bên dưới.
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_user_lock')
  @Get('admin/users/lookup')
  lookupUser(@Query('query') query: string) {
    return this.accountLifecycle.findByPhoneOrId(query);
  }

  // Admin khoá/hạn chế/mở lại — quyền manage_user_lock (đã seed sẵn, xem scripts/create-owner.ts).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_user_lock')
  @Patch('admin/users/:id/status')
  setAccountStatus(@Param('id') userId: string, @Body() dto: SetAccountStatusDto) {
    return this.accountLifecycle.setAccountStatus(
      userId,
      dto.status,
      dto.reason ?? null,
      dto.restrictedUntil ? new Date(dto.restrictedUntil) : null,
    );
  }

  // Danh sách người dùng, tìm theo SĐT/bí danh (tai-lieu-chuc-nang.md #91).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('view_users')
  @Get('admin/users')
  searchUsers(@Query('query') query?: string, @Query('page') page?: string) {
    return this.adminUserQueries.search(query, page ? Number.parseInt(page, 10) : 1);
  }

  // Chi tiết đầy đủ 1 người dùng — bắt buộc ghi lý do (tai-lieu-chuc-nang.md #92).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('view_users')
  @Post('admin/users/:id/reveal')
  revealUserDetail(
    @Param('id') userId: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: RevealUserDetailDto,
  ) {
    return this.adminUserQueries.revealDetail(admin.id, userId, dto.reason);
  }

  // Hàng đợi yêu cầu xoá dữ liệu đang chờ, để admin xử lý thủ công khi cần gấp (tai-lieu-chuc-nang.md #104).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_data_deletion')
  @Get('admin/data-deletion-requests')
  listPendingDeletions() {
    return this.accountLifecycle.listPendingDeletions();
  }

  // Đẩy nhanh xoá ngay, bỏ qua thời gian ân hạn còn lại (tai-lieu-chuc-nang.md #104).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_data_deletion')
  @Post('admin/data-deletion-requests/:userId/expedite')
  expediteDeletion(@Param('userId') userId: string) {
    return this.accountLifecycle.expediteDeletion(userId);
  }
}
