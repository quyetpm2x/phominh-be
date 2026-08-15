import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TrustScoreService } from '../votes/trust-score.service';

import { currentPeriod } from './reward-period.util';

// Khoá bậc đầu tháng — Phương án B đã chốt (bussiness §5.1b): xếp hạng thưởng dùng bậc TẠI THỜI
// ĐIỂM ĐẦU THÁNG, cố định suốt tháng đó (dù huy hiệu hiển thị công khai vẫn cập nhật real-time theo
// bậc thật). Chạy cho MỌI user active, không lọc theo cờ earn — lọc đó diễn ra lúc tổng hợp bảng xếp
// hạng (leaderboard.service.ts), giữ cron này đơn giản và có thể tái dùng cho mục đích thống kê khác.
@Injectable()
export class TierLockCronService {
  private readonly logger = new Logger(TierLockCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly trustScore: TrustScoreService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async lockTiersForNewMonth(): Promise<void> {
    const { period } = currentPeriod();
    const activeUsers = await this.prisma.user.findMany({
      where: { accountStatus: 'active' },
      select: { id: true },
    });
    if (activeUsers.length === 0) return;

    const userIds = activeUsers.map((u) => u.id);
    const displayScores = await this.usersService.getDisplayTrustScoresForUsers(userIds);

    for (const userId of userIds) {
      const tier = this.trustScore.getBadgeTier(displayScores.get(userId) ?? 0);
      await this.prisma.monthlyTierSnapshot.upsert({
        where: { userId_period: { userId, period } },
        create: { userId, period, tierAtMonthStart: tier },
        update: { tierAtMonthStart: tier },
      });
    }
    this.logger.log(`Đã khoá bậc đầu tháng ${period} cho ${userIds.length} user`);
  }
}
