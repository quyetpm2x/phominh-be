import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';

import { isRewardsActivated, rewardForRank } from './reward-payout.util';
import { previousPeriod, type PeriodRange } from './reward-period.util';
import { rankTierUsers } from './reward-score.util';
import { RewardStatsService } from './reward-stats.service';
import { RewardWalletService } from './reward-wallet.service';

const TIER_COUNT = 7;

// Chốt bảng xếp hạng thưởng + phát thưởng cuối tháng (bussiness §5.1b/c) — chạy đầu tháng KẾ TIẾP,
// xử lý dữ liệu của tháng VỪA KẾT THÚC (previousPeriod). Idempotent theo từng bậc: nếu bậc đó đã có
// LeaderboardSnapshot cho kỳ này thì bỏ qua hẳn — tránh phát thưởng trùng nếu cron bị chạy lại
// (redeploy, retry...). Vẫn ghi snapshot dù CHƯA đạt mốc 100 user (rewardAmount=null) để user xem
// trước thứ hạng của mình — chỉ riêng việc PHÁT TIỀN mới bị gate theo mốc (bussiness §5.1c).
@Injectable()
export class LeaderboardSnapshotCronService {
  private readonly logger = new Logger(LeaderboardSnapshotCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: RewardStatsService,
    private readonly wallet: RewardWalletService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_NOON)
  async finalizePreviousMonth(): Promise<void> {
    const range = previousPeriod();
    const activeUserCount = await this.prisma.user.count({ where: { accountStatus: 'active' } });
    const activated = isRewardsActivated(activeUserCount);

    for (let tier = 0; tier < TIER_COUNT; tier++) {
      await this.finalizeTier(range, tier, activated);
    }
  }

  private async finalizeTier(range: PeriodRange, tier: number, activated: boolean): Promise<void> {
    const alreadyDone = await this.prisma.leaderboardSnapshot.count({
      where: { period: range.period, tier },
    });
    if (alreadyDone > 0) return;

    const eligibleUsers = await this.prisma.user.findMany({
      where: {
        accountStatus: 'active',
        earnViaPostsEnabled: true,
        earnEnabledAt: { not: null, lte: range.end },
        monthlyTierSnapshots: { some: { period: range.period, tierAtMonthStart: tier } },
        // Cộng tác viên nội bộ vẫn tương tác bình thường (để trông tự nhiên) nhưng không được
        // chiếm suất xếp hạng/thưởng thật của user thật.
        isCollaborator: false,
      },
      select: { id: true },
    });
    if (eligibleUsers.length === 0) return;

    const statsByUser = await this.stats.getStatsForUsers(
      eligibleUsers.map((u) => u.id),
      range,
    );
    const ranked = rankTierUsers([...statsByUser.values()]);

    for (const r of ranked) {
      const rewardAmount = activated ? rewardForRank(tier, r.rank) : null;
      await this.prisma.leaderboardSnapshot.create({
        data: {
          period: range.period,
          tier,
          userId: r.userId,
          score: r.score,
          rank: r.rank,
          rewardAmount,
        },
      });
      if (rewardAmount) {
        await this.wallet.credit(
          r.userId,
          rewardAmount,
          'leaderboard',
          `${range.period}:tier${tier}:rank${r.rank}`,
        );
      }
    }
    this.logger.log(
      `Đã chốt bảng xếp hạng thưởng ${range.period} bậc ${tier} — ${ranked.length} user`,
    );
  }
}
