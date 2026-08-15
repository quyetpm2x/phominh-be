import { createHmac } from 'node:crypto';

import { verifyHmacSignature } from './webhook-signature.util';

const SECRET = 'test-secret';

function sign(payload: string, secret: string = SECRET): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('verifyHmacSignature', () => {
  it('chữ ký đúng → true', () => {
    const payload = '{"amount":50000}';
    expect(verifyHmacSignature(payload, sign(payload), SECRET)).toBe(true);
  });

  it('sai secret → false', () => {
    const payload = '{"amount":50000}';
    expect(verifyHmacSignature(payload, sign(payload, 'wrong-secret'), SECRET)).toBe(false);
  });

  it('payload bị đổi (dù chữ ký hợp lệ với payload gốc) → false', () => {
    const payload = '{"amount":50000}';
    const tampered = '{"amount":99999999}';
    expect(verifyHmacSignature(tampered, sign(payload), SECRET)).toBe(false);
  });

  it('chữ ký không phải hex hợp lệ/độ dài khác → false, không throw', () => {
    expect(verifyHmacSignature('payload', 'khong-phai-hex', SECRET)).toBe(false);
    expect(verifyHmacSignature('payload', '', SECRET)).toBe(false);
  });
});
