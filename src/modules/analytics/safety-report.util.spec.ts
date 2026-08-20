import { averageHoursBetween, percentage } from './safety-report.util';

describe('averageHoursBetween', () => {
  it('mảng rỗng → null (không có gì để tính)', () => {
    expect(averageHoursBetween([])).toBeNull();
  });

  it('1 cặp cách nhau đúng 2 giờ → 2', () => {
    const from = new Date('2026-08-18T00:00:00.000Z');
    const to = new Date('2026-08-18T02:00:00.000Z');
    expect(averageHoursBetween([{ from, to }])).toBe(2);
  });

  it('nhiều cặp → lấy trung bình, làm tròn 1 chữ số thập phân', () => {
    const base = new Date('2026-08-18T00:00:00.000Z');
    const pairs = [
      { from: base, to: new Date(base.getTime() + 1 * 60 * 60 * 1000) }, // 1h
      { from: base, to: new Date(base.getTime() + 2 * 60 * 60 * 1000) }, // 2h
      { from: base, to: new Date(base.getTime() + 3 * 60 * 60 * 1000) }, // 3h
    ];
    expect(averageHoursBetween(pairs)).toBe(2);
  });
});

describe('percentage', () => {
  it('denominator=0 → 0 (không phải NaN)', () => {
    expect(percentage(5, 0)).toBe(0);
  });

  it('tính đúng %, làm tròn 1 chữ số thập phân', () => {
    expect(percentage(1, 3)).toBe(33.3);
  });

  it('numerator=0 → 0', () => {
    expect(percentage(0, 10)).toBe(0);
  });
});
