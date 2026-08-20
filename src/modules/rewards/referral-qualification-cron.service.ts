import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';

import { RewardsService } from './rewards.service';

const QUALIFICATION_WINDOW_DAYS = 7; // khớp RewardsService.qualifyIfActive

// Xét thưởng giới thiệu (tai-lieu-chuc-nang.md #55/#56) — trước đây RewardsService.qualifyIfActive()
// hoàn toàn mồ côi, không cron/route nào gọi tới, nên tiền thưởng giới thiệu KHÔNG BAO GIỜ được cấp
// dù người được mời hoạt động đủ điều kiện trong 7 ngày. Chạy hàng ngày, chỉ xét các lượt redeem còn
// trong cửa sổ 7 ngày — qua cửa sổ mà chưa qualify coi như trượt vĩnh viễn, không cần xét lại mãi.
@Injectable()
export class ReferralQualificationCronService {
  private readonly logger = new Logger(ReferralQualificationCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async qualifyPendingReferrals(): Promise<void> {
    const cutoff = new Date(Date.now() - QUALIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const pending = await this.prisma.referralRedemption.findMany({
      where: { qualifiedAt: null, createdAt: { gte: cutoff } },
      select: { id: true },
    });
    if (pending.length === 0) return;

    let qualifiedCount = 0;
    for (const { id } of pending) {
      if (await this.rewardsService.qualifyIfActive(id)) qualifiedCount++;
    }
    this.logger.log(`Đã xét ${pending.length} lượt giới thiệu chờ, ${qualifiedCount} đủ điều kiện`);
  }
}
