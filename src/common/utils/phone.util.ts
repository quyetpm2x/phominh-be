// Bắt buộc import từ '/max' (đủ metadata) — bản gốc 'libphonenumber-js' không phân biệt được
// loại số (getType() luôn trả undefined), khiến không lọc được số cố định (02x)/số cũ trước 2018.
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

// Chuẩn hoá SĐT về E.164 (+84...) để lưu DB — không tự viết regex tay, giao cho libphonenumber-js
// xử lý hết các biến thể user hay gõ nhầm: thiếu số 0 đầu (9 số), gõ cả +84 không dấu + (11-12 số),
// số cố định (02x), số cũ trước đợt chuyển đổi 2018 (01x, đã hết hiệu lực). Trả về null nếu không
// parse được — caller tự quyết định thông báo lỗi phù hợp ngữ cảnh (send-otp DTO vs verify-otp).
export function normalizeVnPhoneNumber(input: string): string | null {
  const trimmed = input.trim();
  const parsed = parsePhoneNumberFromString(trimmed, 'VN');
  if (!parsed || !parsed.isValid() || parsed.getType() !== 'MOBILE') {
    return null;
  }
  return parsed.number; // dạng E.164, vd +84912345678
}

// eSMS (và đa số gateway SMS trong nước) nhận Phone dạng nội địa 0xxxxxxxxx, khác với E.164 lưu DB.
export function toDomesticPhoneFormat(e164Phone: string): string {
  return e164Phone.replace('+84', '0');
}
