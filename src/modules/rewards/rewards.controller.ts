import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { RedeemReferralDto } from './dto/redeem-referral.dto';
import { RewardsService } from './rewards.service';

@ApiTags('rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('referral-code')
  getReferralCode(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.getOrCreateReferralCode(user.id);
  }

  @Post('referral-code/redeem')
  redeemReferral(@CurrentUser() user: AuthenticatedUser, @Body() dto: RedeemReferralDto) {
    return this.rewardsService.redeemReferral(user.id, dto.code);
  }

  // Xem danh sách đã giới thiệu thành công (tai-lieu-chuc-nang.md #56).
  @Get('referral-code/redemptions')
  listMyReferrals(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.listMyReferrals(user.id);
  }
}
