import { currentVietnamDayOfWeek, currentVietnamHHmm } from './vietnam-time.util';

describe('currentVietnamHHmm', () => {
  it('trả về giờ:phút theo múi giờ Asia/Ho_Chi_Minh (UTC+7), không phụ thuộc múi giờ server', () => {
    // 2026-08-17T10:15:00Z = 17:15 giờ Việt Nam
    expect(currentVietnamHHmm(new Date('2026-08-17T10:15:00.000Z'))).toBe('17:15');
  });

  it('xử lý đúng khi UTC+7 vòng sang ngày hôm sau', () => {
    // 2026-08-17T23:30:00Z = 06:30 ngày 18/08 giờ Việt Nam
    expect(currentVietnamHHmm(new Date('2026-08-17T23:30:00.000Z'))).toBe('06:30');
  });
});

describe('currentVietnamDayOfWeek', () => {
  it('trả đúng thứ trong tuần theo giờ Việt Nam (0=CN..6=T7)', () => {
    // 2026-08-17 là thứ Hai
    expect(currentVietnamDayOfWeek(new Date('2026-08-17T10:15:00.000Z'))).toBe(1);
  });

  it('lệch ngày so với UTC gần nửa đêm giờ Việt Nam vẫn tính đúng theo VN', () => {
    // 2026-08-17T23:30:00Z = 06:30 SÁNG 18/08 giờ VN (thứ Ba), dù UTC vẫn còn là 17/08 (thứ Hai)
    expect(currentVietnamDayOfWeek(new Date('2026-08-17T23:30:00.000Z'))).toBe(2);
  });

  it('đúng thời điểm nửa đêm giờ Việt Nam (17:00:00Z = 00:00:00 giờ VN) đã sang ngày mới', () => {
    expect(currentVietnamDayOfWeek(new Date('2026-08-17T17:00:00.000Z'))).toBe(2);
  });
});
