const GRACE_DAYS = 30;

// Tách khỏi AccountLifecycleService để test thuần (tai-lieu-chuc-nang.md #69/#73, mô hình mềm 30
// ngày). Làm tròn LÊN — còn vài giờ trong ngày cuối vẫn tính là "còn 1 ngày", không hiện "còn 0
// ngày" gây hiểu lầm đã hết hạn.
export function computeDaysRemaining(deletionRequestedAt: Date, now: Date): number {
  const deadline = deletionRequestedAt.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((deadline - now.getTime()) / (24 * 60 * 60 * 1000)));
}
