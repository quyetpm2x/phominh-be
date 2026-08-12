import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { LinkBankAccountDto } from './dto/link-bank-account.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('api')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/merchants/:merchantId/subscriptions')
  createSubscription(@Param('merchantId') merchantId: string, @Body() dto: CreateSubscriptionDto) {
    return this.paymentsService.createSubscription(merchantId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/users/me/bank-accounts')
  linkBankAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: LinkBankAccountDto) {
    return this.paymentsService.linkBankAccount(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/payouts')
  requestPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.paymentsService.requestPayout(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_payouts')
  @Patch('admin/payouts/:id/process')
  processPayout(@Param('id') id: string) {
    return this.paymentsService.processPayout(id);
  }
}
