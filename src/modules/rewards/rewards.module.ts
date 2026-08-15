import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { EarnSettingsService } from './earn-settings.service';
import { EmergencyRewardStatsService } from './emergency-reward-stats.service';
import { LeaderboardSnapshotCronService } from './leaderboard-snapshot-cron.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { RewardStatsService } from './reward-stats.service';
import { RewardWalletService } from './reward-wallet.service';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { TierLockCronService } from './tier-lock-cron.service';
import { WalletController } from './wallet.controller';

// RewardWalletService export ra ngoài — PaymentsModule cần nó để trừ/hoàn ví lúc xử lý payout
// (xem payments.module.ts).
@Module({
  imports: [UsersModule],
  controllers: [RewardsController, LeaderboardController, WalletController],
  providers: [
    RewardsService,
    RewardWalletService,
    RewardStatsService,
    EmergencyRewardStatsService,
    LeaderboardService,
    EarnSettingsService,
    TierLockCronService,
    LeaderboardSnapshotCronService,
  ],
  exports: [RewardWalletService],
})
export class RewardsModule {}
