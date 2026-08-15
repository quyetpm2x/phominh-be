import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { EmergencyRewardStatsService } from './emergency-reward-stats.service';
import type { PeriodRange } from './reward-period.util';
import type { UserPeriodStats } from './reward-score.util';

// Truy vấn dữ liệu THÔ cho công thức xếp hạng thưởng (bussiness §5.1b) — mỗi hàm đọc thẳng từ
// Prisma, kết quả truyền vào reward-score.util.ts (hàm thuần tuý) để tính điểm.
@Injectable()
export class RewardStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emergencyStats: EmergencyRewardStatsService,
  ) {}

  async getStatsForUsers(
    userIds: string[],
    range: PeriodRange,
  ): Promise<Map<string, UserPeriodStats>> {
    if (userIds.length === 0) return new Map();

    const [
      users,
      deltaE1ByUser,
      postCountByUser,
      activeDaysByUser,
      confirmedPostsByUser,
      confirmationCreditByUser,
      violationsByUser,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, createdAt: true },
      }),
      this.getDeltaE1ByUser(userIds, range),
      this.getPostCountByUser(userIds, range),
      this.getActiveDaysByUser(userIds, range),
      this.emergencyStats.getConfirmedEmergencyPostsByUser(userIds, range),
      this.emergencyStats.getEmergencyConfirmationCreditByUser(userIds, range),
      this.getViolationCountsByUser(userIds, range),
    ]);

    const result = new Map<string, UserPeriodStats>();
    for (const user of users) {
      result.set(user.id, {
        userId: user.id,
        createdAt: user.createdAt,
        deltaE1: deltaE1ByUser.get(user.id) ?? 0,
        postCount: postCountByUser.get(user.id) ?? 0,
        activeDays: activeDaysByUser.get(user.id) ?? 0,
        confirmedEmergencyPosts: confirmedPostsByUser.get(user.id) ?? 0,
        cappedEmergencyConfirmations: confirmationCreditByUser.get(user.id) ?? 0,
        violations: violationsByUser.get(user.id) ?? { light: 0, medium: 0, severe: 0 },
      });
    }
    return result;
  }

  // Tổng weight_applied của vote NHẬN ĐƯỢC trong kỳ — Vote không có cột authorId trực tiếp, phải lọc
  // qua post/comment liên quan (bussiness §5.1b "tính riêng trong tháng, không phải tổng tích luỹ").
  private async getDeltaE1ByUser(
    userIds: string[],
    range: PeriodRange,
  ): Promise<Map<string, number>> {
    const votes = await this.prisma.vote.findMany({
      where: {
        createdAt: { gte: range.start, lt: range.end },
        OR: [{ post: { authorId: { in: userIds } } }, { comment: { authorId: { in: userIds } } }],
      },
      select: {
        weightApplied: true,
        post: { select: { authorId: true } },
        comment: { select: { authorId: true } },
      },
    });
    const result = new Map<string, number>();
    for (const v of votes) {
      const authorId = v.post?.authorId ?? v.comment?.authorId;
      if (!authorId) continue;
      result.set(authorId, (result.get(authorId) ?? 0) + v.weightApplied);
    }
    return result;
  }

  private async getPostCountByUser(
    userIds: string[],
    range: PeriodRange,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.post.groupBy({
      by: ['authorId'],
      where: {
        authorId: { in: userIds },
        status: { not: 'removed' },
        createdAt: { gte: range.start, lt: range.end },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.authorId, r._count._all]));
  }

  // Số NGÀY RIÊNG BIỆT có mở app trong kỳ (bussiness §5.1b "chặn cày điểm dồn dập cuối tháng").
  private async getActiveDaysByUser(
    userIds: string[],
    range: PeriodRange,
  ): Promise<Map<string, number>> {
    const sessions = await this.prisma.appSession.findMany({
      where: { userId: { in: userIds }, openedAt: { gte: range.start, lt: range.end } },
      select: { userId: true, openedAt: true },
    });
    const daysByUser = new Map<string, Set<string>>();
    for (const s of sessions) {
      if (!daysByUser.has(s.userId)) daysByUser.set(s.userId, new Set());
      daysByUser.get(s.userId)!.add(s.openedAt.toISOString().slice(0, 10));
    }
    const result = new Map<string, number>();
    for (const [userId, days] of daysByUser) result.set(userId, days.size);
    return result;
  }

  private async getViolationCountsByUser(
    userIds: string[],
    range: PeriodRange,
  ): Promise<Map<string, { light: number; medium: number; severe: number }>> {
    const rows = await this.prisma.trustScoreHistory.findMany({
      where: {
        userId: { in: userIds },
        sourceType: 'violation_confirmed',
        createdAt: { gte: range.start, lt: range.end },
      },
      select: { userId: true, severity: true },
    });
    const result = new Map<string, { light: number; medium: number; severe: number }>();
    for (const row of rows) {
      if (!row.severity) continue;
      const counts = result.get(row.userId) ?? { light: 0, medium: 0, severe: 0 };
      counts[row.severity]++;
      result.set(row.userId, counts);
    }
    return result;
  }
}
