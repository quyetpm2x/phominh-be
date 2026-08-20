import { isWithinQuietHours } from './quiet-hours.util';

describe('isWithinQuietHours', () => {
  it('khung thường (start < end): trong khoảng', () => {
    expect(isWithinQuietHours('10:30', '09:00', '12:00')).toBe(true);
  });

  it('khung thường: ngoài khoảng', () => {
    expect(isWithinQuietHours('13:00', '09:00', '12:00')).toBe(false);
  });

  it('khung xuyên đêm (start > end, vd 22:00–07:00): sau nửa đêm vẫn tính là yên tĩnh', () => {
    expect(isWithinQuietHours('23:30', '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours('05:00', '22:00', '07:00')).toBe(true);
  });

  it('khung xuyên đêm: giữa trưa không phải giờ yên tĩnh', () => {
    expect(isWithinQuietHours('13:00', '22:00', '07:00')).toBe(false);
  });

  it('start === end: coi như không có giờ yên tĩnh nào', () => {
    expect(isWithinQuietHours('23:00', '08:00', '08:00')).toBe(false);
  });

  it('null (chưa tự chọn) dùng mặc định 22:00–07:00', () => {
    expect(isWithinQuietHours('23:30', null, null)).toBe(true);
    expect(isWithinQuietHours('13:00', null, null)).toBe(false);
  });

  it('biên: đúng giờ bắt đầu tính là yên tĩnh, đúng giờ kết thúc thì không', () => {
    expect(isWithinQuietHours('22:00', '22:00', '07:00')).toBe(true);
    expect(isWithinQuietHours('07:00', '22:00', '07:00')).toBe(false);
  });
});
