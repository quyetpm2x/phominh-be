import { Injectable, NotImplementedException } from '@nestjs/common';
import type { DailyMetricsSnapshot } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { daysAgoUtc, startOfUtcDay } from './dashboard-date.util';

const ACTIVE_MERCHANT_WINDOW_DAYS = 7;

export interface DashboardSummary {
  newUsersToday: number;
  newPostsToday: number;
  pendingReports: number;
  activeMerchants: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // 4 số liệu cốt lõi (tai-lieu-chuc-nang.md #85) — đếm trực tiếp, KHÔNG qua DailyMetricsSnapshot
  // (bảng đó dành cho G1-G8 chi tiết hơn, cần cron riêng chưa xây — xem computeNorthStarMetric()).
  async getDashboardSummary(): Promise<DashboardSummary> {
    const todayStart = startOfUtcDay();
    const activeMerchantWindowStart = daysAgoUtc(ACTIVE_MERCHANT_WINDOW_DAYS);

    const [newUsersToday, newPostsToday, pendingReports, activeMerchantPosts] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.post.count({
        where: { createdAt: { gte: todayStart }, status: { not: 'removed' } },
      }),
      this.prisma.report.count({ where: { status: 'pending' } }),
      this.prisma.post.findMany({
        where: {
          postType: 'merchant',
          status: { not: 'removed' },
          createdAt: { gte: activeMerchantWindowStart },
        },
        distinct: ['authorId'],
        select: { authorId: true },
      }),
    ]);

    return {
      newUsersToday,
      newPostsToday,
      pendingReports,
      activeMerchants: activeMerchantPosts.length,
    };
  }

  // Đọc snapshot đã tính sẵn — việc TÍNH (cron hàng ngày, bussiness §9.7 G1-G8) chưa implement, xem
  // computeNorthStarMetric(). daily_metrics_snapshots chỉ có dữ liệu sau khi job cron đó chạy lần đầu.
  async getDailySnapshot(date: Date, areaId?: string): Promise<DailyMetricsSnapshot | null> {
    // findFirst thay vì findUnique — Prisma không cho truyền null vào field nullable trong compound
    // unique input (snapshotDate_areaId), dù @@unique([snapshotDate, areaId]) cho phép areaId null.
    return this.prisma.dailyMetricsSnapshot.findFirst({
      where: { snapshotDate: date, areaId: areaId ?? null },
    });
  }

  // G1 — Chỉ số Bắc Đẩu (bussiness §9.7): "% số lần mở app mà user thấy ≥1 bài MỚI (chưa từng xem)
  // trong bán kính của họ". Cần bảng theo dõi "đã xem bài nào" (post_views hoặc tương tự) — CHƯA có
  // trong schema.prisma của scaffold này, nên chưa tính được. Thêm bảng đó là bước tiếp theo hợp lý
  // khi implement thật, không phải việc có thể giả lập ở đây.
  computeNorthStarMetric(): Promise<number> {
    throw new NotImplementedException(
      'computeNorthStarMetric (G1) cần bảng theo dõi lượt xem bài — chưa có trong schema base scaffold',
    );
  }
}
