import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { PeriodRange } from './reward-period.util';

// Điều kiện tính điểm khẩn cấp cho leaderboard (bussiness §5.1b) — KHÁC điều kiện "hiển thị rộng"
// (bài đăng vẫn hiện ngay dù chưa đủ điều kiện này, chỉ ảnh hưởng điểm thưởng). Bán kính nhỏ đã được
// enforce lúc GHI xác nhận (emergency.service.ts, CONFIRMATION_RADIUS_METERS), không cần lặp lại ở đây.
const ACCOUNT_AGE_MIN_MS = 24 * 60 * 60 * 1000;
const CONFIRMATION_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_CREDITED_CONFIRMATIONS_PER_POST = 5;

@Injectable()
export class EmergencyRewardStatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Số bài khẩn cấp CỦA CHÍNH user đạt "đã xác nhận" trong kỳ — hệ số 10đ/bài (bussiness §5.1b).
  async getConfirmedEmergencyPostsByUser(
    userIds: string[],
    range: PeriodRange,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.post.groupBy({
      by: ['authorId'],
      where: {
        authorId: { in: userIds },
        postType: 'emergency',
        emergencyVerifiedAt: { not: null },
        createdAt: { gte: range.start, lt: range.end },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.authorId, r._count._all]));
  }

  // Lượt xác nhận GIÚP NGƯỜI KHÁC, đã lọc điều kiện hợp lệ (tài khoản ≥24h tuổi lúc xác nhận, xác
  // nhận trong 2h kể từ lúc đăng) VÀ cap 5 lượt ĐƯỢC TÍNH/bài — hệ số 3đ/lượt (bussiness §5.1b). Cap
  // tính trên TOÀN BỘ người xác nhận của 1 bài (không riêng theo userIds đang truy vấn), nên phải nạp
  // lại đủ danh sách xác nhận của các bài liên quan, không chỉ phần của userIds.
  async getEmergencyConfirmationCreditByUser(
    userIds: string[],
    range: PeriodRange,
  ): Promise<Map<string, number>> {
    const ownConfirmations = await this.prisma.emergencyConfirmation.findMany({
      where: { confirmerId: { in: userIds }, createdAt: { gte: range.start, lt: range.end } },
      select: { postId: true },
    });
    const postIds = [...new Set(ownConfirmations.map((c) => c.postId))];
    if (postIds.length === 0) return new Map();

    const allConfirmations = await this.prisma.emergencyConfirmation.findMany({
      where: { postId: { in: postIds } },
      select: {
        postId: true,
        confirmerId: true,
        createdAt: true,
        post: { select: { createdAt: true } },
        confirmer: { select: { createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const creditByUser = new Map<string, number>();
    const creditedCountByPost = new Map<string, number>();
    for (const c of allConfirmations) {
      const accountAgeMs = c.createdAt.getTime() - c.confirmer.createdAt.getTime();
      const windowMs = c.createdAt.getTime() - c.post.createdAt.getTime();
      const eligible =
        accountAgeMs >= ACCOUNT_AGE_MIN_MS && windowMs >= 0 && windowMs <= CONFIRMATION_WINDOW_MS;
      if (!eligible) continue;

      const creditedSoFar = creditedCountByPost.get(c.postId) ?? 0;
      if (creditedSoFar >= MAX_CREDITED_CONFIRMATIONS_PER_POST) continue;
      creditedCountByPost.set(c.postId, creditedSoFar + 1);
      creditByUser.set(c.confirmerId, (creditByUser.get(c.confirmerId) ?? 0) + 1);
    }
    return creditByUser;
  }
}
