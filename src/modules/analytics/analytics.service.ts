import { Injectable, NotImplementedException } from '@nestjs/common';
import type { DailyMetricsSnapshot } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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
