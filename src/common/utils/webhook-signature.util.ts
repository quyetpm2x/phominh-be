import { createHmac, timingSafeEqual } from 'node:crypto';

// Xác thực chữ ký webhook (HMAC-SHA256) — dùng chung cho callback từ đối tác thanh toán (Momo/VNPay
// chi hộ...), so sánh bằng timingSafeEqual để tránh timing attack dò chữ ký. Payload PHẢI là chuỗi
// gốc (raw body) đúng như đối tác đã ký, không phải JSON.stringify lại — thứ tự field khác đi là
// chữ ký sai.
export function verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
