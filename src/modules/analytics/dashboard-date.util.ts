// Ranh giới ngày/tuần dùng cho dashboard tổng quan (tai-lieu-chuc-nang.md #85) — hàm THUẦN TÚY,
// UTC (cùng convention reward-period.util.ts) để không phụ thuộc múi giờ server.

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function daysAgoUtc(days: number, now: Date = new Date()): Date {
  return new Date(startOfUtcDay(now).getTime() - days * 24 * 60 * 60 * 1000);
}
