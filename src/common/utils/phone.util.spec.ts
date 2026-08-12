import { normalizeVnPhoneNumber, toDomesticPhoneFormat } from './phone.util';

describe('normalizeVnPhoneNumber', () => {
  it('chuẩn hoá số 10 số đúng chuẩn', () => {
    expect(normalizeVnPhoneNumber('0912345678')).toBe('+84912345678');
  });

  it('tự thêm 0 khi thiếu (9 số)', () => {
    expect(normalizeVnPhoneNumber('912345678')).toBe('+84912345678');
  });

  it('strip 84 khi gõ thiếu dấu + (11 số)', () => {
    expect(normalizeVnPhoneNumber('84912345678')).toBe('+84912345678');
  });

  it('xử lý gõ cả 84 lẫn 0 (12 số)', () => {
    expect(normalizeVnPhoneNumber('840912345678')).toBe('+84912345678');
  });

  it('từ chối số cố định (đầu 02x)', () => {
    expect(normalizeVnPhoneNumber('0212345678')).toBeNull();
  });

  it('từ chối số cũ trước đợt chuyển đổi 2018 (đầu 01)', () => {
    expect(normalizeVnPhoneNumber('01234567890')).toBeNull();
  });

  it('từ chối chuỗi rỗng/không phải số', () => {
    expect(normalizeVnPhoneNumber('')).toBeNull();
    expect(normalizeVnPhoneNumber('abc')).toBeNull();
  });
});

describe('toDomesticPhoneFormat', () => {
  it('convert E.164 sang dạng nội địa cho eSMS', () => {
    expect(toDomesticPhoneFormat('+84912345678')).toBe('0912345678');
  });
});
