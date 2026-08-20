import { Injectable } from '@nestjs/common';
import type { DailyMetricsSnapshot } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { DailySnapshotMetrics } from './daily-snapshot-metrics';
import { daysAgoUtc, startOfUtcDay } from './dashboard-date.util';

const ACTIVE_MERCHANT_WINDOW_DAYS = 7;
const NORTH_STAR_WINDOW_DAYS = 7;
const MERCHANT_POST_RATE_WINDOW_DAYS = 28;
const MERCHANT_AT_RISK_DAYS = 14;
const MERCHANT_WATCH_DAYS = 7;

export interface NorthStarMetric {
  percentage: number;
  sessionsWithNewPost: number;
  totalSessions: number;
}

export type MerchantRiskStatus = 'ok' | 'watch' | 'at_risk';

export interface MerchantRiskItem {
  id: string;
  businessName: string;
  lastPostAt: Date | null;
  daysSinceLastPost: number | null;
  postsPerWeek: number;
  status: MerchantRiskStatus;
}

export interface DashboardSummary {
  newUsersToday: number;
  newPostsToday: number;
  pendingReports: number;
  activeMerchants: number;
}

export interface LatestSnapshotItem {
  areaId: string | null;
  areaName: string;
  snapshotDate: Date;
  metrics: DailySnapshotMetrics;
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
      // isCollaborator: false — cộng tác viên nội bộ không tính vào tăng trưởng thật.
      this.prisma.user.count({ where: { createdAt: { gte: todayStart }, isCollaborator: false } }),
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

  // G2-G4 — bản mới nhất theo từng khu + toàn hệ thống (tai-lieu-chuc-nang.md #107). "distinct on"
  // lấy đúng 1 dòng/areaId, ưu tiên snapshot_date mới nhất — DailyMetricsSnapshotCronService chạy
  // hàng ngày nên thường đây là snapshot của hôm qua, trừ khi cron lỗi/khu vực mới tạo chưa có lượt
  // chạy nào.
  async getLatestSnapshots(): Promise<LatestSnapshotItem[]> {
    const [rows, areas] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ area_id: string | null; snapshot_date: Date; metrics: unknown }>
      >`
        select distinct on (area_id) area_id, snapshot_date, metrics
        from daily_metrics_snapshots
        order by area_id, snapshot_date desc
      `,
      this.prisma.pilotArea.findMany({ select: { id: true, name: true } }),
    ]);
    const nameById = new Map(areas.map((a) => [a.id, a.name]));

    return rows.map((r) => ({
      areaId: r.area_id,
      areaName:
        r.area_id === null ? 'Toàn hệ thống' : (nameById.get(r.area_id) ?? 'Khu vực đã xoá'),
      snapshotDate: r.snapshot_date,
      metrics: r.metrics as DailySnapshotMetrics,
    }));
  }

  // G1 — Chỉ số Bắc Đẩu (bussiness §9.7): "% số lần mở app mà user thấy ≥1 bài MỚI (chưa từng xem)
  // trong bán kính của họ". `post_views` (mục 44) đã đủ dữ liệu để tính THẬT: upsert theo unique
  // [postId, viewerId] (PostViewsService.recordView) nên `viewedAt` luôn là LẦN ĐẦU TIÊN user đó xem
  // bài — mọi PostView do đó tự động là "bài mới" theo đúng định nghĩa, không cần cột đánh dấu riêng.
  // "Trong bán kính" không kiểm tra lại ở đây — feed chỉ trả bài trong bán kính (ST_DWithin) nên mọi
  // PostView phát sinh từ luồng bình thường đã thoả điều kiện này.
  // Khớp phiên (app_sessions) với các lượt xem xảy ra TRONG khoảng [opened_at, phiên_kế_tiếp) bằng
  // window function LEAD — cách duy nhất xác định "phiên nào" 1 PostView thuộc về, vì PostView không
  // lưu appSessionId riêng.
  async computeNorthStarMetric(days = NORTH_STAR_WINDOW_DAYS): Promise<NorthStarMetric> {
    const windowStart = daysAgoUtc(days);
    const rows = await this.prisma.$queryRaw<
      Array<{ sessions_with_new_post: bigint; total_sessions: bigint }>
    >`
      with sessions as (
        select
          aps.user_id,
          aps.opened_at,
          lead(aps.opened_at) over (partition by aps.user_id order by aps.opened_at) as next_opened_at
        from app_sessions aps
        join users u on u.id = aps.user_id
        where aps.opened_at >= ${windowStart} and u.is_collaborator = false
      )
      select
        count(*) filter (
          where exists (
            select 1 from post_views pv
            where pv.viewer_id = sessions.user_id
              and pv.viewed_at >= sessions.opened_at
              and pv.viewed_at < coalesce(sessions.next_opened_at, now())
          )
        ) as sessions_with_new_post,
        count(*) as total_sessions
      from sessions
    `;

    const totalSessions = Number(rows[0]?.total_sessions ?? 0);
    const sessionsWithNewPost = Number(rows[0]?.sessions_with_new_post ?? 0);
    const percentage = totalSessions === 0 ? 0 : (sessionsWithNewPost / totalSessions) * 100;

    return { percentage, sessionsWithNewPost, totalSessions };
  }

  // G6 — Báo cáo Merchant (bussiness §9.7): "tần suất đăng trung bình, retention merchant riêng
  // biệt (rời bỏ nhanh là rủi ro nghiêm trọng)". KHÔNG có ngưỡng "rời bỏ" cụ thể nào trong bussiness
  // — tự chọn 2 mốc dựa trên cùng cửa sổ 7 ngày đã dùng cho "merchant hoạt động" ở dashboard tổng
  // quan (nhất quán nội bộ): >14 ngày không đăng = at_risk (đỏ), 7-14 ngày = watch (vàng). "Số lượt
  // bấm Hiện SĐT/Zalo" trong bussiness CHƯA LÀM — cần bảng theo dõi click riêng, chưa có (cùng hạ
  // tầng còn thiếu như mục 99).
  async listMerchantRisk(): Promise<MerchantRiskItem[]> {
    const windowStart = daysAgoUtc(MERCHANT_POST_RATE_WINDOW_DAYS);
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        business_name: string;
        last_post_at: Date | null;
        posts_in_window: bigint;
      }>
    >`
      select
        mp.id,
        mp.business_name,
        max(p.created_at) as last_post_at,
        count(*) filter (where p.created_at >= ${windowStart}) as posts_in_window
      from merchant_profiles mp
      left join posts p on p.author_id = mp.user_id and p.post_type = 'merchant'
      group by mp.id, mp.business_name
      order by last_post_at asc nulls first
    `;

    const now = Date.now();
    return rows.map((r) => {
      const daysSinceLastPost = r.last_post_at
        ? Math.floor((now - r.last_post_at.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: r.id,
        businessName: r.business_name,
        lastPostAt: r.last_post_at,
        daysSinceLastPost,
        postsPerWeek: Number(r.posts_in_window) / (MERCHANT_POST_RATE_WINDOW_DAYS / 7),
        status: merchantRiskStatus(daysSinceLastPost),
      };
    });
  }
}

function merchantRiskStatus(daysSinceLastPost: number | null): MerchantRiskStatus {
  if (daysSinceLastPost === null || daysSinceLastPost > MERCHANT_AT_RISK_DAYS) return 'at_risk';
  if (daysSinceLastPost > MERCHANT_WATCH_DAYS) return 'watch';
  return 'ok';
}
