import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { AdminLeaderboardController } from './admin-leaderboard.controller';
import { EarnSettingsService } from './earn-settings.service';
import { EmergencyRewardStatsService } from './emergency-reward-stats.service';
import { LeaderboardSnapshotCronService } from './leaderboard-snapshot-cron.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { ReferralQualificationCronService } from './referral-qualification-cron.service';
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
  controllers: [
    RewardsController,
    LeaderboardController,
    WalletController,
    AdminLeaderboardController,
  ],
  providers: [
    RewardsService,
    RewardWalletService,
    RewardStatsService,
    EmergencyRewardStatsService,
    LeaderboardService,
    EarnSettingsService,
    TierLockCronService,
    LeaderboardSnapshotCronService,
    ReferralQualificationCronService,
  ],
  exports: [RewardWalletService],
})
export class RewardsModule {}
