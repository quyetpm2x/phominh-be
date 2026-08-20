// Giờ yên tĩnh (tai-lieu-chuc-nang.md #48) — trước đây quietHoursStart/End chỉ LƯU, không có nơi
// nào ĐỌC lại để chặn gửi push. Áp dụng cho push thiết bị; thông báo trong app vẫn luôn được ghi
// (không mất tin, chỉ hoãn phần gây rung/kêu máy). null = user chưa tự chọn, dùng mặc định 22:00–
// 07:00 (khớp giá trị FE đã luôn hiển thị sẵn ở settings/notifications.tsx dù chưa có API chỉnh sửa).
const DEFAULT_QUIET_HOURS_START = '22:00';
const DEFAULT_QUIET_HOURS_END = '07:00';

// Hỗ trợ khung xuyên đêm (start > end, vd 22:00–07:00). start === end coi là không có giờ yên tĩnh
// nào (khung rỗng), tránh chặn push cả ngày nếu dữ liệu bị nhập sai.
export function isWithinQuietHours(
  nowHHmm: string,
  start: string | null,
  end: string | null,
): boolean {
  const from = start ?? DEFAULT_QUIET_HOURS_START;
  const to = end ?? DEFAULT_QUIET_HOURS_END;
  if (from === to) return false;
  if (from < to) return nowHHmm >= from && nowHHmm < to;
  return nowHHmm >= from || nowHHmm < to;
}
