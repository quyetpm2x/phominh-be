// Giờ hiện tại theo múi giờ Việt Nam (UTC+7, không DST) — dùng chung cho mọi logic phụ thuộc "giờ
// trong ngày" (giờ yên tĩnh thông báo #48, khung giờ hiện SĐT/Zalo merchant #43), không phụ thuộc
// múi giờ server đang chạy (thường là UTC trên cloud).
export function currentVietnamHHmm(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const WEEKDAY_TO_NUMBER: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// 0=Chủ nhật .. 6=Thứ Bảy (khớp JS Date.getDay()), nhưng tính đúng theo NGÀY giờ Việt Nam — server
// chạy UTC có thể đang ở ngày khác VN (vd 23:30 giờ VN = 16:30 UTC cùng ngày, nhưng gần nửa đêm VN
// thì UTC vẫn là hôm trước, ngược lại buổi sáng sớm VN thì UTC có thể đã sang ngày mới).
export function currentVietnamDayOfWeek(date: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
  }).format(date);
  return WEEKDAY_TO_NUMBER[weekday];
}
