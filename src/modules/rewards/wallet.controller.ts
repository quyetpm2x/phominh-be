import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { UpdateEarnSettingsDto } from './dto/earn-settings.dto';
import { EarnSettingsService } from './earn-settings.service';
import { RewardWalletService } from './reward-wallet.service';

@ApiTags('rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/rewards')
export class WalletController {
  constructor(
    private readonly wallet: RewardWalletService,
    private readonly earnSettings: EarnSettingsService,
  ) {}

  @Get('wallet')
  async getWallet(@CurrentUser() user: AuthenticatedUser) {
    const [balance, recentLedger] = await Promise.all([
      this.wallet.getBalance(user.id),
      this.wallet.getRecentLedger(user.id),
    ]);
    return { balance, recentLedger };
  }

  @Get('earn-settings')
  getEarnSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.earnSettings.getSettings(user.id);
  }

  @Patch('earn-settings')
  updateEarnSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateEarnSettingsDto) {
    return this.earnSettings.updateSettings(user.id, dto);
  }
}
