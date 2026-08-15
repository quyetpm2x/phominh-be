// Công thức xếp hạng thưởng (bussiness §5.1b) — hàm THUẦN TÚY, không import Prisma. Nơi gọi
// (reward-stats.service.ts + leaderboard.service.ts/leaderboard-snapshot-cron.service.ts) tự truy
// vấn DB rồi truyền dữ liệu thô vào đây.

export interface ViolationCounts {
  light: number;
  medium: number;
  severe: number;
}

export interface UserPeriodStats {
  userId: string;
  deltaE1: number; // tổng weight_applied vote nhận trong tháng
  postCount: number; // số bài hợp lệ (status != removed) tính theo created_at trong tháng
  activeDays: number; // số NGÀY RIÊNG BIỆT có hoạt động
  confirmedEmergencyPosts: number; // số bài khẩn cấp của chính user đạt emergencyVerifiedAt trong tháng
  cappedEmergencyConfirmations: number; // tổng lượt xác nhận user đã cho người khác, ĐÃ cap 5/bài
  violations: ViolationCounts; // vi phạm bị admin xác nhận trong tháng
  createdAt: Date; // thâm niên tài khoản — tie-break bước 3
}

export interface RankedUser {
  userId: string;
  score: number;
  rank: number;
}

const WEIGHTS = { deltaE1: 0.4, postCount: 0.25, regularity: 0.15, emergency: 0.2 };

// percentile = (hạng tính từ THẤP lên CAO ÷ tổng số user trong bậc) × 100 — người giá trị thô cao
// nhất luôn nhận percentile=100 bất kể quy mô bậc (bussiness §5.1b). Hoà value → hạng trung bình
// cộng (VD 2 người cùng hạng 2-3 → percentile tính theo hạng 2.5).
export function computePercentiles(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];

  const ascending = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const percentiles = new Array<number>(n);
  let start = 0;
  while (start < n) {
    let end = start;
    while (end + 1 < n && ascending[end + 1].v === ascending[start].v) end++;
    const avgRank = (start + 1 + end + 1) / 2; // hạng 1-based, trung bình cộng nếu hoà
    for (let k = start; k <= end; k++) percentiles[ascending[k].i] = (avgRank / n) * 100;
    start = end + 1;
  }
  return percentiles;
}

// tổng_trọng_lượng = Nhẹ×1 + Trung_bình×2 + Nghiêm_trọng×5 → hệ số 1.0 xuống 0.5 (bussiness §5.1b) —
// vi phạm Nghiêm trọng (trọng số 5) tự động đạt sàn 0.5 chỉ với 1 lần, không cần điều kiện riêng.
export function violationFactor(counts: ViolationCounts): number {
  const weight = counts.light * 1 + counts.medium * 2 + counts.severe * 5;
  if (weight <= 0) return 1.0;
  if (weight === 1) return 0.9;
  if (weight === 2) return 0.8;
  if (weight === 3) return 0.7;
  if (weight === 4) return 0.6;
  return 0.5;
}

// (10 × số bài khẩn cấp được xác nhận) + (3 × số lượt xác nhận giúp người khác, tối đa 5 lượt/bài)
// — nơi gọi PHẢI tự cap 5/bài trước khi truyền vào đây (bussiness §5.1b).
export function emergencyRawScore(confirmedPosts: number, cappedConfirmations: number): number {
  return confirmedPosts * 10 + cappedConfirmations * 3;
}

export function rankingScore(
  factorPercentiles: {
    deltaE1Percentile: number;
    postCountPercentile: number;
    regularityPercentile: number;
    emergencyPercentile: number;
  },
  violationFactorValue: number,
): number {
  const weighted =
    WEIGHTS.deltaE1 * factorPercentiles.deltaE1Percentile +
    WEIGHTS.postCount * factorPercentiles.postCountPercentile +
    WEIGHTS.regularity * factorPercentiles.regularityPercentile +
    WEIGHTS.emergency * factorPercentiles.emergencyPercentile;
  return weighted * violationFactorValue;
}

interface ScoredUser {
  userId: string;
  score: number;
  rawDeltaE1: number;
  rawPostCount: number;
  createdAt: Date;
}

// Xử lý hoà ở điểm CUỐI CÙNG — (1) ΔE1 thô cao hơn, (2) số bài hợp lệ nhiều hơn, (3) tài khoản tạo
// trước (bussiness §5.1b).
function compareForRanking(a: ScoredUser, b: ScoredUser): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.rawDeltaE1 !== a.rawDeltaE1) return b.rawDeltaE1 - a.rawDeltaE1;
  if (b.rawPostCount !== a.rawPostCount) return b.rawPostCount - a.rawPostCount;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

// Điểm vào là TOÀN BỘ user thuộc CÙNG 1 bậc (đã khoá bậc đầu tháng) — percentile tính riêng trong
// nhóm này, không trộn giữa các bậc (bussiness §5.1b "7 bảng RIÊNG BIỆT, không gộp").
export function rankTierUsers(stats: UserPeriodStats[]): RankedUser[] {
  if (stats.length === 0) return [];

  const deltaE1Percentiles = computePercentiles(stats.map((s) => s.deltaE1));
  const postCountPercentiles = computePercentiles(stats.map((s) => s.postCount));
  const regularityPercentiles = computePercentiles(stats.map((s) => s.activeDays));
  const emergencyPercentiles = computePercentiles(
    stats.map((s) => emergencyRawScore(s.confirmedEmergencyPosts, s.cappedEmergencyConfirmations)),
  );

  const scored: ScoredUser[] = stats.map((s, i) => ({
    userId: s.userId,
    rawDeltaE1: s.deltaE1,
    rawPostCount: s.postCount,
    createdAt: s.createdAt,
    score: rankingScore(
      {
        deltaE1Percentile: deltaE1Percentiles[i],
        postCountPercentile: postCountPercentiles[i],
        regularityPercentile: regularityPercentiles[i],
        emergencyPercentile: emergencyPercentiles[i],
      },
      violationFactor(s.violations),
    ),
  }));

  scored.sort(compareForRanking);
  return scored.map((s, i) => ({ userId: s.userId, score: s.score, rank: i + 1 }));
}
