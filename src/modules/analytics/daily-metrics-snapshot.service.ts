import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type PilotArea } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { DailySnapshotMetrics } from './daily-snapshot-metrics';
import { daysAgoUtc, startOfUtcDay } from './dashboard-date.util';

const RETENTION_DAYS = [1, 7, 30] as const;

// Mục tiêu tính snapshot: null = toàn hệ thống (không lọc theo bán kính), hoặc 1 PilotArea cụ thể.
type SnapshotTarget = { areaId: string | null; area: PilotArea | null };

// Tính & lưu G2-G4 mỗi ngày theo từng khu thí điểm (tai-lieu-chuc-nang.md #107) — trước đây bảng
// `daily_metrics_snapshots` chỉ được ĐỌC (AnalyticsService.getDailySnapshot), không có cron/route nào
// GHI vào, nên luôn rỗng. "% thời gian feed trống" (G2) và "nguồn tải app" (G3) trong bussiness §9.7
// KHÔNG tính được ở đây — phần đầu cần theo dõi liên tục ngoài phạm vi 1 cron ngày/lần, phần sau cần
// SDK attribution (Adjust/AppsFlyer...) chưa tích hợp — không bịa số cho 2 phần đó.
@Injectable()
export class DailyMetricsSnapshotService {
  private readonly logger = new Logger(DailyMetricsSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  // targetDate mặc định = hôm qua (giờ UTC) — snapshot cho 1 ngày ĐÃ KẾT THÚC hẳn, tránh số liệu
  // "nửa ngày" nhìn có vẻ thấp bất thường nếu tính ngay trong ngày đang diễn ra.
  async computeAndStoreDailySnapshots(targetDate: Date = daysAgoUtc(1)): Promise<void> {
    const snapshotDate = startOfUtcDay(targetDate);
    const areas = await this.prisma.pilotArea.findMany({ where: { isActive: true } });
    const targets: SnapshotTarget[] = [
      { areaId: null, area: null },
      ...areas.map((area) => ({ areaId: area.id, area })),
    ];

    for (const target of targets) {
      const metrics = await this.computeMetricsForTarget(snapshotDate, target);
      await this.upsertSnapshot(snapshotDate, target.areaId, metrics);
    }
    this.logger.log(
      `Đã tính snapshot ngày ${snapshotDate.toISOString().slice(0, 10)} cho ${targets.length} mục tiêu (toàn hệ thống + ${areas.length} khu).`,
    );
  }

  private async computeMetricsForTarget(
    snapshotDate: Date,
    target: SnapshotTarget,
  ): Promise<DailySnapshotMetrics> {
    const [g2, g3, g4] = await Promise.all([
      this.computeG2(snapshotDate, target),
      this.computeG3(snapshotDate, target),
      this.computeG4(snapshotDate, target),
    ]);
    return { g2, g3, g4 };
  }

  // Điều kiện lọc bài đăng theo bán kính khu (chỉ khi có target.area) — dùng chung cho mọi truy vấn
  // trên bảng posts trong service này.
  private postAreaFilter(target: SnapshotTarget): Prisma.Sql {
    if (!target.area) return Prisma.empty;
    return Prisma.sql`and ST_DWithin(
      p.posted_location,
      ST_SetSRID(ST_MakePoint(${target.area.lng}, ${target.area.lat}), 4326)::geography,
      ${target.area.radiusKm * 1000}
    )`;
  }

  // Điều kiện lọc user theo khu vực "Nhà" nằm trong bán kính khu (chỉ khi có target.area) — LUÔN
  // dùng trong truy vấn có alias "u" cho bảng users (hoặc "cohort" với cột id tương đương, xem
  // computeRetentionForDay — CTE cohort chọn thẳng u.id nên vẫn khớp tên cột).
  private userHomeAreaFilter(target: SnapshotTarget): Prisma.Sql {
    if (!target.area) return Prisma.empty;
    return Prisma.sql`and exists (
      select 1 from fixed_areas fa
      where fa.user_id = u.id and fa.label = 'home'
        and ST_DWithin(
          fa.location,
          ST_SetSRID(ST_MakePoint(${target.area.lng}, ${target.area.lat}), 4326)::geography,
          ${target.area.radiusKm * 1000}
        )
    )`;
  }

  private async computeG2(
    snapshotDate: Date,
    target: SnapshotTarget,
  ): Promise<DailySnapshotMetrics['g2']> {
    const nextDay = new Date(snapshotDate.getTime() + 24 * 60 * 60 * 1000);
    const areaFilter = this.postAreaFilter(target);

    const [postRows] = await this.prisma.$queryRaw<
      Array<{ total: bigint; life: bigint; merchant: bigint; emergency: bigint }>
    >`
      select
        count(*) as total,
        count(*) filter (where p.post_type = 'life') as life,
        count(*) filter (where p.post_type = 'merchant') as merchant,
        count(*) filter (where p.post_type = 'emergency') as emergency
      from posts p
      where p.created_at >= ${snapshotDate} and p.created_at < ${nextDay}
        and p.status != 'removed'
        ${areaFilter}
    `;
    const [ageRows] = await this.prisma.$queryRaw<Array<{ avg_hours: number | null }>>`
      select avg(extract(epoch from (pv.viewed_at - p.created_at)) / 3600) as avg_hours
      from post_views pv
      join posts p on p.id = pv.post_id
      where pv.viewed_at >= ${snapshotDate} and pv.viewed_at < ${nextDay}
        ${areaFilter}
    `;

    const total = Number(postRows?.total ?? 0);
    const pct = (n: bigint | undefined) =>
      total === 0 ? 0 : Math.round(((Number(n ?? 0) / total) * 100 + Number.EPSILON) * 10) / 10;

    return {
      newPostsCount: total,
      postTypeRatio: {
        life: pct(postRows?.life),
        merchant: pct(postRows?.merchant),
        emergency: pct(postRows?.emergency),
      },
      avgPostAgeHoursWhenViewed:
        ageRows?.avg_hours == null ? null : Math.round(ageRows.avg_hours * 10) / 10,
    };
  }

  private async computeG3(
    snapshotDate: Date,
    target: SnapshotTarget,
  ): Promise<DailySnapshotMetrics['g3']> {
    const nextDay = new Date(snapshotDate.getTime() + 24 * 60 * 60 * 1000);
    const homeFilter = this.userHomeAreaFilter(target);

    const [rows] = await this.prisma.$queryRaw<Array<{ total: bigint; onboarded: bigint }>>`
      select
        count(*) as total,
        count(*) filter (where exists (select 1 from fixed_areas fa where fa.user_id = u.id)) as onboarded
      from users u
      where u.created_at >= ${snapshotDate} and u.created_at < ${nextDay}
        and u.is_collaborator = false
        ${homeFilter}
    `;

    const total = Number(rows?.total ?? 0);
    return {
      newAccountsCount: total,
      onboardingCompletionRate:
        total === 0
          ? null
          : Math.round(((Number(rows?.onboarded ?? 0) / total) * 100 + Number.EPSILON) * 10) / 10,
    };
  }

  private async computeG4(
    snapshotDate: Date,
    target: SnapshotTarget,
  ): Promise<DailySnapshotMetrics['g4']> {
    const [d1, d7, d30] = await Promise.all(
      RETENTION_DAYS.map((n) => this.computeRetentionForDay(snapshotDate, n, target)),
    );
    return { retentionD1: d1, retentionD7: d7, retentionD30: d30 };
  }

  // Retention D{n} kiểu cổ điển: trong cohort user ĐĂNG KÝ đúng n ngày trước snapshotDate, bao nhiêu %
  // có mở app (app_sessions) đúng vào ngày snapshotDate. Không phải retention luỹ kế.
  private async computeRetentionForDay(
    snapshotDate: Date,
    n: number,
    target: SnapshotTarget,
  ): Promise<number | null> {
    const cohortStart = new Date(snapshotDate.getTime() - n * 24 * 60 * 60 * 1000);
    const cohortEnd = new Date(cohortStart.getTime() + 24 * 60 * 60 * 1000);
    const nextDay = new Date(snapshotDate.getTime() + 24 * 60 * 60 * 1000);
    const homeFilter = this.userHomeAreaFilter(target);

    const [rows] = await this.prisma.$queryRaw<Array<{ cohort_size: bigint; retained: bigint }>>`
      with cohort as (
        select u.id from users u
        where u.created_at >= ${cohortStart} and u.created_at < ${cohortEnd}
          and u.is_collaborator = false
          ${homeFilter}
      )
      select
        count(*) as cohort_size,
        count(*) filter (where exists (
          select 1 from app_sessions s
          where s.user_id = cohort.id and s.opened_at >= ${snapshotDate} and s.opened_at < ${nextDay}
        )) as retained
      from cohort
    `;

    const cohortSize = Number(rows?.cohort_size ?? 0);
    if (cohortSize === 0) return null;
    return (
      Math.round(((Number(rows?.retained ?? 0) / cohortSize) * 100 + Number.EPSILON) * 10) / 10
    );
  }

  // upsert thủ công thay vì prisma.upsert() — compound unique [snapshotDate, areaId] không nhận
  // được areaId=null làm input (giới hạn Prisma), xem comment tương tự ở AnalyticsService.getDailySnapshot.
  private async upsertSnapshot(
    snapshotDate: Date,
    areaId: string | null,
    metrics: DailySnapshotMetrics,
  ): Promise<void> {
    const existing = await this.prisma.dailyMetricsSnapshot.findFirst({
      where: { snapshotDate, areaId },
    });
    const metricsJson = metrics as unknown as Prisma.InputJsonValue;
    if (existing) {
      await this.prisma.dailyMetricsSnapshot.update({
        where: { id: existing.id },
        data: { metrics: metricsJson },
      });
    } else {
      await this.prisma.dailyMetricsSnapshot.create({
        data: { snapshotDate, areaId, metrics: metricsJson },
      });
    }
  }
}
