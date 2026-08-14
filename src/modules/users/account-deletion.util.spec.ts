import { computeDaysRemaining } from './account-deletion.util';

describe('computeDaysRemaining — mô hình xoá tài khoản mềm 30 ngày (tai-lieu-chuc-nang.md #69/#73)', () => {
  it('vừa yêu cầu xoá => còn đủ 30 ngày', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(computeDaysRemaining(now, now)).toBe(30);
  });

  it('đã qua 29 ngày => còn 1 ngày', () => {
    const requestedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-30T00:00:00Z');
    expect(computeDaysRemaining(requestedAt, now)).toBe(1);
  });

  it('đã qua 30 ngày => hết hạn, còn 0 (không âm)', () => {
    const requestedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-02-05T00:00:00Z');
    expect(computeDaysRemaining(requestedAt, now)).toBe(0);
  });

  it('còn vài giờ trong ngày cuối => vẫn làm tròn lên thành 1, không phải 0', () => {
    const requestedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-30T20:00:00Z');
    expect(computeDaysRemaining(requestedAt, now)).toBe(1);
  });
});
