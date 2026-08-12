import { Injectable } from '@nestjs/common';

// Thuật toán cốt lõi #3 (tai-lieu-cong-nghe-backend.md §7.3 / tài liệu bussiness §4.2 / §7D.1) —
// hàm THUẦN TÚY, không import Prisma/HTTP, nhận đủ dữ liệu qua tham số (§2.3b). Nơi gọi
// (votes.service.ts, users.service.ts) tự truy vấn DB rồi truyền vào.

export type ViolationSeverity = 'light' | 'medium' | 'severe';

// Bậc huy hiệu 0-6 theo mốc lũy thừa 10 (bussiness §4.2d) — điểm hiển thị = E1 - E2_hiệu_lực.
const TIER_THRESHOLDS = [0, 100, 1_000, 10_000, 50_000, 200_000, 500_000];

export const TIER_LABELS = [
  '🌱 Người mới',
  '🏠 Hàng xóm',
  '⭐ Người đóng góp',
  '🏆 Cư dân gương mẫu',
  '🎖️ Người có uy tín trong khu',
  '🌟 Cột trụ cộng đồng',
  '👑 Huyền thoại khu phố',
] as const;

// Trọng số vote dừng tăng ở bậc 3 — 1 tài khoản không thể tích luỹ quyền lực vô hạn (bussiness §4.2d).
const TIER_WEIGHT = [1.0, 2.0, 3.0, 4.0] as const;

// [sàn, trần] theo TỪNG bậc × TỪNG mức độ — bảng nguyên văn bussiness §4.2b, không dùng % hay số cố định.
const PENALTY_TABLE: Record<number, Record<ViolationSeverity, [number, number]>> = {
  0: { light: [2, 5], medium: [5, 15], severe: [15, 40] },
  1: { light: [10, 30], medium: [30, 80], severe: [80, 200] },
  2: { light: [50, 150], medium: [150, 400], severe: [400, 1_000] },
  3: { light: [200, 600], medium: [600, 1_500], severe: [1_500, 4_000] },
  4: { light: [500, 1_500], medium: [1_500, 4_000], severe: [4_000, 9_000] },
  5: { light: [800, 2_500], medium: [2_500, 6_000], severe: [6_000, 12_000] },
  6: { light: [1_000, 3_000], medium: [3_000, 8_000], severe: [8_000, 15_000] },
};

const PENALTY_DECAY_DAYS = 180;

@Injectable()
export class TrustScoreService {
  // trustScoreDisplay = E1 - E2_hiệu_lực tại thời điểm gọi (nơi gọi tự tính, xem getEffectivePenalty).
  getBadgeTier(trustScoreDisplay: number): number {
    let tier = 0;
    for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
      if (trustScoreDisplay >= TIER_THRESHOLDS[i]) tier = i;
    }
    return tier;
  }

  getBadgeLabel(tier: number): string {
    return TIER_LABELS[tier] ?? TIER_LABELS[0];
  }

  // Lần mở app gần nhất quyết định hệ số — KHÔNG dùng đăng bài/bình luận (bussiness §4.2c).
  getActivityFactor(lastAppSessionAt: Date, now: Date = new Date()): number {
    const days = (now.getTime() - lastAppSessionAt.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 90) return 1.0;
    if (days <= 180) return 0.7;
    return 0.4;
  }

  calculateVoteWeight(
    voterTrustScoreDisplay: number,
    voterLastAppSessionAt: Date,
    now: Date = new Date(),
  ): number {
    const tier = this.getBadgeTier(voterTrustScoreDisplay);
    const weightTier = Math.min(tier, 3);
    const activityFactor = this.getActivityFactor(voterLastAppSessionAt, now);
    return TIER_WEIGHT[weightTier] * activityFactor;
  }

  // severityScore ∈ [0,1] — mức độ nghiêm trọng cụ thể trong khung "nhẹ/trung bình/nghiêm trọng",
  // do admin đánh giá thủ công (report) hoặc quy tắc tự động (GPS giả/EXIF lệch) gán sẵn.
  calculatePenalty(
    violatorTier: number,
    severity: ViolationSeverity,
    severityScore: number,
  ): number {
    const clampedTier = Math.min(Math.max(violatorTier, 0), 6);
    const clampedScore = Math.min(Math.max(severityScore, 0), 1);
    const [floor, ceiling] = PENALTY_TABLE[clampedTier][severity];
    return floor + clampedScore * (ceiling - floor);
  }

  // E2_hiệu_lực(t) = E2 × max(0, 1 − số_ngày/180) — phai hoàn toàn sau 180 ngày nếu không tái phạm.
  getEffectivePenalty(originalE2: number, appliedAt: Date, now: Date = new Date()): number {
    const days = (now.getTime() - appliedAt.getTime()) / (1000 * 60 * 60 * 24);
    const remaining = Math.max(0, 1 - days / PENALTY_DECAY_DAYS);
    return originalE2 * remaining;
  }
}
