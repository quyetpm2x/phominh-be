import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { AccountLifecycleService } from './account-lifecycle.service';
import { SetAccountStatusDto } from './dto/set-account-status.dto';

// Tách khỏi UsersController (đã gần giới hạn 250 dòng) — điều khoản (#67), khoá/hạn chế (#74), yêu
// cầu xoá tài khoản (#69/#73). Controller '@Controller(\'api\')' (không phải 'api/mobile/users') vì
// mixed mobile + admin route, cùng pattern reports.controller.ts/payments.controller.ts.
@ApiTags('users')
@Controller('api')
export class AccountLifecycleController {
  constructor(private readonly accountLifecycle: AccountLifecycleService) {}

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
}
