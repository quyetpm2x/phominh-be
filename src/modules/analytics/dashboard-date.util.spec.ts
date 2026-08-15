import { daysAgoUtc, startOfUtcDay } from './dashboard-date.util';

describe('startOfUtcDay', () => {
  it('cắt về 00:00:00 UTC cùng ngày', () => {
    expect(startOfUtcDay(new Date('2026-08-14T23:59:59.000Z')).toISOString()).toBe(
      '2026-08-14T00:00:00.000Z',
    );
  });
});

describe('daysAgoUtc', () => {
  it('lùi đúng số ngày tính từ đầu ngày UTC hiện tại', () => {
    expect(daysAgoUtc(7, new Date('2026-08-14T12:00:00.000Z')).toISOString()).toBe(
      '2026-08-07T00:00:00.000Z',
    );
  });

  it('0 ngày = đầu ngày hôm nay', () => {
    expect(daysAgoUtc(0, new Date('2026-08-14T12:00:00.000Z')).toISOString()).toBe(
      '2026-08-14T00:00:00.000Z',
    );
  });
});
