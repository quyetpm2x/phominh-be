import { buildDailyCounts } from './merchant-stats.util';

describe('buildDailyCounts — điền 7 ngày gần nhất (tai-lieu-chuc-nang.md #44)', () => {
  const now = new Date('2026-01-10T12:00:00Z');

  it('không có dữ liệu ngày nào => 7 số 0', () => {
    expect(buildDailyCounts(new Map(), now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('điền đúng vị trí theo ngày, ngày hôm nay ở cuối mảng', () => {
    const countByDay = new Map([
      ['2026-01-04', 3], // 6 ngày trước — đầu mảng
      ['2026-01-10', 9], // hôm nay — cuối mảng
    ]);
    expect(buildDailyCounts(countByDay, now)).toEqual([3, 0, 0, 0, 0, 0, 9]);
  });

  it('luôn trả đúng 7 phần tử', () => {
    expect(buildDailyCounts(new Map(), now)).toHaveLength(7);
  });
});
