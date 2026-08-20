import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { daysAgoUtc } from './dashboard-date.util';
import { averageHoursBetween, percentage } from './safety-report.util';

const SAFETY_REPORT_WINDOW_DAYS = 30;

export interface SafetyReport {
  windowDays: number;
  totalPosts: number;
  totalReports: number;
  reportRatePercent: number;
  avgReviewTimeHours: number | null;
  commentAttackIncidentCount: number;
  voteCollusionFlagCount: number;
  avgEmergencyVerificationHours: number | null;
}

// G7 — An toàn & Kiểm duyệt (bussiness §9.7, tai-lieu-chuc-nang.md #109): "tỷ lệ report/tổng bài
// đăng, thời gian xử lý report trung bình, số lần phát hiện cụm tấn công, số cụm thông đồng vote bị
// phát hiện, thời gian trung bình để tin khẩn cấp đạt đủ xác nhận". Tách khỏi AnalyticsService (giữ
// file đó dưới 250 dòng theo quy ước dự án).
@Injectable()
export class SafetyReportService {
  constructor(private readonly prisma: PrismaService) {}

  // 2 chỉ số "cụm tấn công"/"thông đồng vote" ĐẾM THẲNG từ bảng `CommentAttackIncident`/
  // `CollusionFlag` — LUÔN ra 0 hiện tại vì cả 2 thuật toán phát hiện đều HOÃN CÓ CHỦ Ý (mục 89/93,
  // tai-lieu-cong-nghe-backend §7D.2), không phải lỗi hiển thị — số sẽ tự động đúng ngay khi 2 tính
  // năng đó được implement thật, không cần sửa gì ở đây.
  async getSafetyReport(): Promise<SafetyReport> {
    const windowStart = daysAgoUtc(SAFETY_REPORT_WINDOW_DAYS);

    const [
      totalPosts,
      totalReports,
      reviewedReports,
      commentAttackIncidentCount,
      voteCollusionFlagCount,
      verifiedEmergencyPosts,
    ] = await Promise.all([
      this.prisma.post.count({
        where: { createdAt: { gte: windowStart }, status: { not: 'removed' } },
      }),
      this.prisma.report.count({ where: { createdAt: { gte: windowStart } } }),
      this.prisma.report.findMany({
        where: { createdAt: { gte: windowStart }, reviewedAt: { not: null } },
        select: { createdAt: true, reviewedAt: true },
      }),
      this.prisma.commentAttackIncident.count({ where: { triggeredAt: { gte: windowStart } } }),
      this.prisma.collusionFlag.count({ where: { detectedAt: { gte: windowStart } } }),
      this.prisma.post.findMany({
        where: {
          postType: 'emergency',
          createdAt: { gte: windowStart },
          emergencyVerifiedAt: { not: null },
        },
        select: { createdAt: true, emergencyVerifiedAt: true },
      }),
    ]);

    return {
      windowDays: SAFETY_REPORT_WINDOW_DAYS,
      totalPosts,
      totalReports,
      reportRatePercent: percentage(totalReports, totalPosts),
      avgReviewTimeHours: averageHoursBetween(
        reviewedReports.map((r) => ({ from: r.createdAt, to: r.reviewedAt! })),
      ),
      commentAttackIncidentCount,
      voteCollusionFlagCount,
      avgEmergencyVerificationHours: averageHoursBetween(
        verifiedEmergencyPosts.map((p) => ({ from: p.createdAt, to: p.emergencyVerifiedAt! })),
      ),
    };
  }
}
