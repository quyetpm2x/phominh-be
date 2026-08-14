// Tách khỏi MerchantsService để test thuần không cần mock Prisma (tai-lieu-chuc-nang.md #44).
// Điền đủ 7 ngày gần nhất theo thứ tự cũ→mới, ngày không có lượt xem nào trả về 0 thay vì bị thiếu
// phần tử (FE vẽ 7 cột biểu đồ, thiếu phần tử sẽ lệch trục).
export function buildDailyCounts(countByDay: Map<string, number>, now: Date): number[] {
  const dailyCounts: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dailyCounts.push(countByDay.get(day) ?? 0);
  }
  return dailyCounts;
}
