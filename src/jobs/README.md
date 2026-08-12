# Hàng đợi nền (BullMQ) — cố tình chưa bật

Theo `tai-lieu-cong-nghe-backend.md` §1 Nguyên tắc 3 và §8: BullMQ/Redis "chỉ cần bật khi đã có
traction thật — MVP thí điểm nhỏ có thể xử lý đồng bộ trực tiếp, thêm hàng đợi khi thấy nghẽn
thật". Scaffold này vì vậy **không cài `bullmq`/`ioredis`, không có `BullModule`** — tránh hạ tầng
chưa cần dùng ngay từ ngày đầu.

Khi có bằng chứng cần (nghẽn thật), các job dự kiến theo đúng bảng ở §8, mỗi job 1 class riêng
theo Command pattern (§2.4):

| Job | Trigger |
|---|---|
| Kiểm duyệt ảnh (Vision API) | Sau khi upload |
| Gửi digest thông báo | Cron định kỳ |
| Tính lại `E2_hiệu_lực` (phai 180 ngày) | Cron hàng ngày, 3h sáng |
| Phát hiện thông đồng vote (graph-based) | Cron mỗi giờ |
| Xử lý lệnh chi hộ Momo/VNPay | Khi duyệt payout |
| Cập nhật `daily_metrics_snapshot` | Cron hàng ngày |

Tới lúc đó: `pnpm add @nestjs/bullmq bullmq ioredis`, thêm `jobs/*.command.ts` mỗi file 1 job, đăng
ký `BullModule` trong `app.module.ts`.
