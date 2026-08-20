import {
  decryptAccountNumber,
  encryptAccountNumber,
  hashAccountNumber,
} from './bank-account-crypto';

const SECRET = 'test-secret-key';

describe('encryptAccountNumber / decryptAccountNumber', () => {
  it('mã hoá rồi giải mã trả lại đúng số tài khoản gốc', () => {
    const encrypted = encryptAccountNumber('0123456789', SECRET);
    expect(decryptAccountNumber(encrypted, SECRET)).toBe('0123456789');
  });

  it('mã hoá 2 lần CÙNG 1 số tài khoản ra 2 ciphertext KHÁC NHAU (IV ngẫu nhiên)', () => {
    const a = encryptAccountNumber('0123456789', SECRET);
    const b = encryptAccountNumber('0123456789', SECRET);
    expect(a).not.toBe(b);
  });
});

describe('hashAccountNumber', () => {
  it('CÙNG 1 số tài khoản + mã ngân hàng → CÙNG 1 hash (so sánh được, khác encrypt)', () => {
    const a = hashAccountNumber('VCB', '0123456789', SECRET);
    const b = hashAccountNumber('VCB', '0123456789', SECRET);
    expect(a).toBe(b);
  });

  it('khác ngân hàng, cùng số tài khoản → hash khác nhau', () => {
    const a = hashAccountNumber('VCB', '0123456789', SECRET);
    const b = hashAccountNumber('TCB', '0123456789', SECRET);
    expect(a).not.toBe(b);
  });

  it('không phân biệt hoa/thường mã ngân hàng', () => {
    const a = hashAccountNumber('vcb', '0123456789', SECRET);
    const b = hashAccountNumber('VCB', '0123456789', SECRET);
    expect(a).toBe(b);
  });

  it('bỏ qua khoảng trắng trong số tài khoản', () => {
    const a = hashAccountNumber('VCB', '0123 4567 89', SECRET);
    const b = hashAccountNumber('VCB', '0123456789', SECRET);
    expect(a).toBe(b);
  });
});
