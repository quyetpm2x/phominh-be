import { isMerchantPhoneVisibleNow, type DayBusinessHour } from './phone-visibility.util';

const MON = 1;
const TUE = 2;

describe('isMerchantPhoneVisibleNow', () => {
  it('always: luôn hiện bất kể giờ nào, kể cả không có khung giờ nào cấu hình', () => {
    expect(isMerchantPhoneVisibleNow('always', [], MON, '03:00')).toBe(true);
  });

  it('hidden: luôn ẩn bất kể giờ nào, kể cả có cấu hình khung giờ', () => {
    const hours: DayBusinessHour[] = [{ dayOfWeek: MON, startTime: '08:00', endTime: '20:00' }];
    expect(isMerchantPhoneVisibleNow('hidden', hours, MON, '10:00')).toBe(false);
  });

  it('business_hours: hiện trong khung giờ thường (start < end) của đúng ngày hôm nay', () => {
    const hours: DayBusinessHour[] = [{ dayOfWeek: MON, startTime: '08:00', endTime: '20:00' }];
    expect(isMerchantPhoneVisibleNow('business_hours', hours, MON, '12:00')).toBe(true);
    expect(isMerchantPhoneVisibleNow('business_hours', hours, MON, '21:00')).toBe(false);
  });

  it('business_hours: ngày khác trong tuần không có cấu hình → ẩn', () => {
    const hours: DayBusinessHour[] = [{ dayOfWeek: MON, startTime: '08:00', endTime: '20:00' }];
    expect(isMerchantPhoneVisibleNow('business_hours', hours, TUE, '12:00')).toBe(false);
  });

  it('business_hours: khung xuyên đêm cùng ngày (vd 18:00–02:00) — phần trước nửa đêm', () => {
    const hours: DayBusinessHour[] = [{ dayOfWeek: MON, startTime: '18:00', endTime: '02:00' }];
    expect(isMerchantPhoneVisibleNow('business_hours', hours, MON, '23:00')).toBe(true);
  });

  it('business_hours: khung xuyên đêm — phần SAU nửa đêm thuộc ngày hôm sau vẫn tính đúng', () => {
    // Thứ Hai mở 18:00–02:00 → 01:00 sáng thứ Ba vẫn còn trong khung (đuôi khung xuyên đêm hôm qua)
    const hours: DayBusinessHour[] = [{ dayOfWeek: MON, startTime: '18:00', endTime: '02:00' }];
    expect(isMerchantPhoneVisibleNow('business_hours', hours, TUE, '01:00')).toBe(true);
    // Nhưng đã qua 02:00 thì hết hiệu lực, kể cả khi thứ Ba chưa có khung riêng
    expect(isMerchantPhoneVisibleNow('business_hours', hours, TUE, '02:30')).toBe(false);
  });

  it('business_hours: khung xuyên đêm hôm qua không lấn sang khung riêng của hôm nay', () => {
    const hours: DayBusinessHour[] = [
      { dayOfWeek: MON, startTime: '18:00', endTime: '02:00' },
      { dayOfWeek: TUE, startTime: '08:00', endTime: '20:00' },
    ];
    // 01:00 thứ Ba vẫn ưu tiên tính là đuôi khung xuyên đêm hôm qua (còn hiệu lực)
    expect(isMerchantPhoneVisibleNow('business_hours', hours, TUE, '01:00')).toBe(true);
    // 10:00 thứ Ba thuộc khung riêng của thứ Ba
    expect(isMerchantPhoneVisibleNow('business_hours', hours, TUE, '10:00')).toBe(true);
  });

  it('business_hours với start === end của ngày hôm nay → ẩn (khung rỗng)', () => {
    const hours: DayBusinessHour[] = [{ dayOfWeek: MON, startTime: '08:00', endTime: '08:00' }];
    expect(isMerchantPhoneVisibleNow('business_hours', hours, MON, '08:00')).toBe(false);
  });
});
