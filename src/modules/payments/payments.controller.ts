import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PayoutStatus } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { AdminPayoutQueriesService } from './admin-payout-queries.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { LinkBankAccountDto } from './dto/link-bank-account.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('api')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly adminPayoutQueries: AdminPayoutQueriesService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/merchants/:merchantId/subscriptions')
  createSubscription(@Param('merchantId') merchantId: string, @Body() dto: CreateSubscriptionDto) {
    return this.paymentsService.createSubscription(merchantId, dto);
  }

  // Lịch sử thanh toán gói merchant (tai-lieu-chuc-nang.md #46).
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mobile/merchants/me/payments')
  getPaymentHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getPaymentHistory(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/users/me/bank-accounts')
  linkBankAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: LinkBankAccountDto) {
    return this.paymentsService.linkBankAccount(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mobile/users/me/bank-accounts')
  getMyBankAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getMyBankAccounts(user.id);
  }

  // Gỡ tài khoản đã liên kết (tai-lieu-chuc-nang.md #54) — không có PATCH sửa tại chỗ, xem lý do
  // trong PaymentsService.unlinkBankAccount.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('mobile/users/me/bank-accounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlinkBankAccount(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.paymentsService.unlinkBankAccount(user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/payouts')
  requestPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.paymentsService.requestPayout(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('mobile/payouts')
  getMyPayoutRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getMyPayoutRequests(user.id);
  }

  // Hàng đợi duyệt chi hộ (tai-lieu-chuc-nang.md #115) — trước đây chỉ có PATCH .../process, không
  // có route nào liệt kê để admin biết payoutRequestId cần gọi.
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_payouts')
  @Get('admin/payouts')
  listPayoutRequests(@Query('status') status?: PayoutStatus) {
    return this.adminPayoutQueries.listPayoutRequests(status);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_payouts')
  @Patch('admin/payouts/:id/process')
  processPayout(@Param('id') id: string) {
    return this.paymentsService.processPayout(id);
  }
}
