import type { PhoneVisibility } from '@prisma/client';

export interface DayBusinessHour {
  dayOfWeek: number; // 0=Chủ nhật .. 6=Thứ Bảy
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

function findDay(hours: DayBusinessHour[], dayOfWeek: number): DayBusinessHour | undefined {
  return hours.find((h) => h.dayOfWeek === dayOfWeek);
}

// Tính "SĐT/Zalo của quán có nên lộ cho người xem bài NGAY BÂY GIỜ hay không" (tai-lieu-chuc-nang.md
// #43) — trước đây phoneVisibility/businessHoursStart/End chỉ do merchant TỰ chọn và LƯU (mục 41),
// không có nơi nào ĐỌC lại để thật sự lộ số cho người xem — dù chọn "Luôn hiện", bài merchant vẫn
// không hiện số điện thoại ở đâu cả. Nay hỗ trợ khung giờ RIÊNG cho từng ngày trong tuần (khác bản
// đầu chỉ có 1 khung áp dụng mọi ngày) + khung xuyên đêm (vd 18:00–02:00, tra cả "hôm qua" để biết
// còn trong đuôi khung xuyên đêm hay không).
export function isMerchantPhoneVisibleNow(
  phoneVisibility: PhoneVisibility,
  businessHours: DayBusinessHour[],
  todayDayOfWeek: number,
  nowHHmm: string,
): boolean {
  if (phoneVisibility === 'always') return true;
  if (phoneVisibility === 'hidden') return false;

  // 'business_hours' — trước tiên tra khung của HÔM QUA: nếu hôm qua là khung xuyên đêm
  // (startTime > endTime) và giờ hiện tại vẫn còn trước endTime, nghĩa là đang ở đuôi khung đó.
  const yesterday = findDay(businessHours, (todayDayOfWeek + 6) % 7);
  if (yesterday && yesterday.startTime > yesterday.endTime && nowHHmm < yesterday.endTime) {
    return true;
  }

  const today = findDay(businessHours, todayDayOfWeek);
  // Chưa cấu hình ngày này, hoặc start===end (khung rỗng) — coi như ẨN, an toàn hơn đoán bừa.
  if (!today || today.startTime === today.endTime) return false;

  if (today.startTime < today.endTime) {
    return nowHHmm >= today.startTime && nowHHmm < today.endTime;
  }
  // Khung xuyên đêm bắt đầu hôm nay — phần trước nửa đêm.
  return nowHHmm >= today.startTime;
}
