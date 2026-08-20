import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

// Cap thời lượng 1 phiên khi tính trung bình/tổng — phòng phiên bị "treo" (app crash/force-kill
// trước khi kịp gửi sự kiện đóng, xem useAppSessionTracking.ts phía mobile) kéo trung bình lên bất
// thường. 6 tiếng là mức rộng rãi cho 1 lượt dùng liên tục thật.
const MAX_SESSION_SECONDS = 6 * 60 * 60;

export interface HourBucket {
  hour: number;
  count: number;
}

export interface UserActivityOverview {
  activeUserCount: number;
  totalSessions: number;
  avgSessionMinutes: number;
  hourHistogram: HourBucket[];
}

export interface UserActivityDetail {
  sessionCount: number;
  totalMinutes: number;
  avgSessionMinutes: number;
  peakHour: number | null;
}

// Thống kê hoạt động người dùng (bổ sung ngoài 117 mục gốc, thảo luận 2026-08-17) — thời lượng
// dùng THẬT tính từ app_sessions.closed_at (mới thêm cùng phiên, xem AppSessionsService) thay vì
// ước lượng. Phiên chưa đóng (closedAt null — app crash/force-kill) tính là 0 giây khi cộng thời
// lượng nhưng VẪN tính vào số lượt mở (session_count), tránh phóng đại trung bình.
@Injectable()
export class UserActivityService {
  constructor(private readonly prisma: PrismaService) {}

  // Tổng quan toàn hệ thống — loại cộng tác viên (isCollaborator) khỏi số liệu thật, cùng nguyên
  // tắc với G1/dashboard tổng quan.
  async getOverview(dateFrom: Date, dateTo: Date): Promise<UserActivityOverview> {
    const [summary] = await this.prisma.$queryRaw<
      Array<{ active_user_count: bigint; total_sessions: bigint; avg_seconds: number | null }>
    >`
      select
        count(distinct aps.user_id) as active_user_count,
        count(*) as total_sessions,
        avg(least(extract(epoch from (coalesce(aps.closed_at, aps.opened_at) - aps.opened_at)), ${MAX_SESSION_SECONDS})) as avg_seconds
      from app_sessions aps
      join users u on u.id = aps.user_id
      where aps.opened_at >= ${dateFrom} and aps.opened_at < ${dateTo} and u.is_collaborator = false
    `;
    const hourRows = await this.prisma.$queryRaw<Array<{ hour: number; cnt: bigint }>>`
      select extract(hour from aps.opened_at)::int as hour, count(*) as cnt
      from app_sessions aps
      join users u on u.id = aps.user_id
      where aps.opened_at >= ${dateFrom} and aps.opened_at < ${dateTo} and u.is_collaborator = false
      group by hour
      order by hour
    `;

    return {
      activeUserCount: Number(summary?.active_user_count ?? 0),
      totalSessions: Number(summary?.total_sessions ?? 0),
      avgSessionMinutes: (summary?.avg_seconds ?? 0) / 60,
      hourHistogram: hourRows.map((r) => ({ hour: r.hour, count: Number(r.cnt) })),
    };
  }

  // Chi tiết 1 user cụ thể (drill-down từ C2, tai-lieu-chuc-nang.md #92) — KHÔNG loại trừ theo
  // isCollaborator vì admin chủ động chọn đúng user này để xem, không phải số liệu tổng hợp.
  async getUserActivity(userId: string, dateFrom: Date, dateTo: Date): Promise<UserActivityDetail> {
    const [summary] = await this.prisma.$queryRaw<
      Array<{ session_count: bigint; total_seconds: number | null; avg_seconds: number | null }>
    >`
      select
        count(*) as session_count,
        sum(least(extract(epoch from (coalesce(closed_at, opened_at) - opened_at)), ${MAX_SESSION_SECONDS})) as total_seconds,
        avg(least(extract(epoch from (coalesce(closed_at, opened_at) - opened_at)), ${MAX_SESSION_SECONDS})) as avg_seconds
      from app_sessions
      where user_id = ${userId}::uuid and opened_at >= ${dateFrom} and opened_at < ${dateTo}
    `;
    const hourRows = await this.prisma.$queryRaw<Array<{ hour: number; cnt: bigint }>>`
      select extract(hour from opened_at)::int as hour, count(*) as cnt
      from app_sessions
      where user_id = ${userId}::uuid and opened_at >= ${dateFrom} and opened_at < ${dateTo}
      group by hour
    `;
    const peakHour = hourRows.reduce<{ hour: number; cnt: bigint } | null>(
      (best, row) => (!best || row.cnt > best.cnt ? row : best),
      null,
    );

    return {
      sessionCount: Number(summary?.session_count ?? 0),
      totalMinutes: (summary?.total_seconds ?? 0) / 60,
      avgSessionMinutes: (summary?.avg_seconds ?? 0) / 60,
      peakHour: peakHour ? peakHour.hour : null,
    };
  }
}
