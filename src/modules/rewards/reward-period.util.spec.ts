import { currentPeriod, periodOf, previousPeriod, rangeOfPeriod } from './reward-period.util';

describe('reward-period.util', () => {
  it('periodOf trả về YYYY-MM theo UTC', () => {
    expect(periodOf(new Date('2026-08-14T23:59:59.000Z'))).toBe('2026-08');
    expect(periodOf(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01');
  });

  it('rangeOfPeriod trả về [đầu tháng, đầu tháng kế tiếp)', () => {
    const range = rangeOfPeriod('2026-08');
    expect(range.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('rangeOfPeriod xử lý đúng khi tháng 12 sang năm mới', () => {
    const range = rangeOfPeriod('2026-12');
    expect(range.end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('currentPeriod dùng thời điểm truyền vào', () => {
    expect(currentPeriod(new Date('2026-08-14T00:00:00.000Z')).period).toBe('2026-08');
  });

  it('previousPeriod lùi đúng 1 tháng, kể cả đầu năm', () => {
    expect(previousPeriod(new Date('2026-08-14T00:00:00.000Z')).period).toBe('2026-07');
    expect(previousPeriod(new Date('2026-01-14T00:00:00.000Z')).period).toBe('2025-12');
  });
});
