import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Mã hoá số tài khoản ngân hàng trước khi lưu (user_bank_accounts.account_number_encrypted, dữ liệu
// nhạy cảm — tài liệu bussiness §11.3). AES-256-GCM, khoá dẫn xuất từ BANK_ACCOUNT_ENCRYPTION_KEY.
// TODO(production): chuyển sang KMS quản lý khoá (AWS KMS/GCP KMS) thay vì biến môi trường thuần —
// đủ dùng cho giai đoạn thí điểm nhỏ, không phải giải pháp cuối cùng.
const ALGORITHM = 'aes-256-gcm';

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, 'pho-minh-bank-account-salt', 32);
}

export function encryptAccountNumber(plain: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString('base64')).join('.');
}

export function decryptAccountNumber(payload: string, secret: string): string {
  const [ivB64, authTagB64, encryptedB64] = payload.split('.');
  const key = deriveKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
