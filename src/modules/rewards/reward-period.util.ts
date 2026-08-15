// Kỳ xếp hạng thưởng = theo THÁNG dương lịch, giờ UTC (bussiness §5.1b "reset theo tháng") — hàm
// THUẦN TÚY, không phụ thuộc Date.now() ngoại trừ giá trị mặc định của tham số.

export interface PeriodRange {
  period: string; // "YYYY-MM"
  start: Date; // đầu tháng, inclusive
  end: Date; // đầu tháng KẾ TIẾP, exclusive
}

export function periodOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function rangeOfPeriod(period: string): PeriodRange {
  const [year, month] = period.split('-').map(Number);
  return {
    period,
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function currentPeriod(now: Date = new Date()): PeriodRange {
  return rangeOfPeriod(periodOf(now));
}

// Kỳ liền trước — cron chốt bảng xếp hạng chạy đầu tháng N+1 nhưng chốt dữ liệu của tháng N.
export function previousPeriod(now: Date = new Date()): PeriodRange {
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return rangeOfPeriod(periodOf(prevMonth));
}
