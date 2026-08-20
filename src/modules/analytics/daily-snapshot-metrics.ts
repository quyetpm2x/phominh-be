// Shape của cột DailyMetricsSnapshot.metrics (Json, cố tình linh hoạt — bussiness §9.7) — phần
// G2-G4 tính bởi DailyMetricsSnapshotService (tai-lieu-chuc-nang.md #107). G1 (Bắc Đẩu) và G6 (Báo
// cáo Merchant) KHÔNG lưu vào bảng này — tính trực tiếp lúc đọc (xem AnalyticsService), không cần
// snapshot theo ngày.
export interface DailySnapshotMetrics {
  g2: {
    newPostsCount: number;
    postTypeRatio: { life: number; merchant: number; emergency: number }; // % làm tròn 1 số lẻ
    avgPostAgeHoursWhenViewed: number | null; // null = không có lượt xem nào trong ngày để tính
  };
  g3: {
    newAccountsCount: number;
    onboardingCompletionRate: number | null; // % tài khoản mới trong ngày đã lưu ≥1 khu vực cố định
  };
  g4: {
    retentionD1: number | null; // null = cohort ngày đó rỗng, không có gì để tính retention
    retentionD7: number | null;
    retentionD30: number | null;
  };
}
