import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { currentPeriod, previousPeriod } from './reward-period.util';
import { rankTierUsers } from './reward-score.util';
import { RewardStatsService } from './reward-stats.service';

export interface LiveLeaderboardEntry {
  userId: string;
  alias: string;
  avatarUrl: string | null;
  rank: number;
  score: number;
}

export interface LeaderboardHistoryEntry {
  userId: string;
  alias: string;
  avatarUrl: string | null;
  rank: number;
  score: number;
  rewardAmount: number | null;
}

// Bảng xếp hạng SỐNG cho tháng ĐANG CHẠY (bussiness §5.1b) — điểm/hạng còn có thể đổi tới cuối
// tháng, KHÁC LeaderboardSnapshot (kết quả CHÍNH THỨC, chốt bởi leaderboard-snapshot-cron.service.ts
// sau khi tháng kết thúc, dùng để phát thưởng thật).
@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: RewardStatsService,
  ) {}

  async getLiveLeaderboard(tier: number): Promise<LiveLeaderboardEntry[]> {
    const range = currentPeriod();
    // "Không hồi tố" (bussiness §5.1a): chỉ user đã bật công tắc 1 mới cạnh tranh thưởng. Đơn giản
    // hoá: earnEnabledAt <= cuối tháng là đủ điều kiện tham gia CẢ tháng — nếu bật GIỮA tháng, hoạt
    // động TRƯỚC mốc bật trong cùng tháng đó vẫn bị tính gộp (chưa cắt theo từng user), TODO khi có
    // traction thật cần query riêng theo mốc earnEnabledAt của từng user.
    const eligibleUsers = await this.prisma.user.findMany({
      where: {
        accountStatus: 'active',
        earnViaPostsEnabled: true,
        earnEnabledAt: { not: null, lte: range.end },
        monthlyTierSnapshots: { some: { period: range.period, tierAtMonthStart: tier } },
      },
      select: { id: true, alias: true, avatarUrl: true },
    });
    if (eligibleUsers.length === 0) return [];

    const statsByUser = await this.stats.getStatsForUsers(
      eligibleUsers.map((u) => u.id),
      range,
    );
    const rankByUser = new Map(rankTierUsers([...statsByUser.values()]).map((r) => [r.userId, r]));

    return eligibleUsers
      .map((u) => {
        const ranked = rankByUser.get(u.id);
        if (!ranked) return null;
        return {
          userId: u.id,
          alias: u.alias,
          avatarUrl: u.avatarUrl,
          rank: ranked.rank,
          score: ranked.score,
        };
      })
      .filter((entry): entry is LiveLeaderboardEntry => entry !== null)
      .sort((a, b) => a.rank - b.rank);
  }

  // Kết quả CHÍNH THỨC đã chốt (LeaderboardSnapshot) — mặc định kỳ VỪA KẾT THÚC nếu không truyền period.
  async getHistory(tier: number, period?: string): Promise<LeaderboardHistoryEntry[]> {
    const resolvedPeriod = period ?? previousPeriod().period;
    const rows = await this.prisma.leaderboardSnapshot.findMany({
      where: { tier, period: resolvedPeriod },
      orderBy: { rank: 'asc' },
      include: { user: { select: { alias: true, avatarUrl: true } } },
    });
    return rows.map((r) => ({
      userId: r.userId,
      alias: r.user.alias,
      avatarUrl: r.user.avatarUrl,
      rank: r.rank,
      score: r.score,
      rewardAmount: r.rewardAmount,
    }));
  }
}
