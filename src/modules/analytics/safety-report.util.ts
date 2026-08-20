// Hàm thuần dùng cho Báo cáo An toàn G7 (tai-lieu-chuc-nang.md #109) — tách khỏi AnalyticsService để
// test được không cần mock Prisma.

export function averageHoursBetween(pairs: { from: Date; to: Date }[]): number | null {
  if (pairs.length === 0) return null;
  const totalHours = pairs.reduce(
    (sum, p) => sum + (p.to.getTime() - p.from.getTime()) / (1000 * 60 * 60),
    0,
  );
  return Math.round((totalHours / pairs.length) * 10) / 10;
}

// Làm tròn 1 chữ số thập phân — 0 nếu denominator=0 thay vì NaN (chưa có bài đăng nào = chưa có gì
// để tính tỷ lệ report, không phải lỗi).
export function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}
