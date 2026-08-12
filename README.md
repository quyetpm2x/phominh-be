# Phố Mình Backend

NestJS (Modular Monolith) + Prisma + PostgreSQL/PostGIS (qua Supabase). Repo riêng biệt, không nằm
chung Turborepo với `web + app/web/` hay `web + app/app/` — xem `tai-lieu-cong-nghe-backend.md` §3
và `tài liệu bussiness.md` §13.2.

## Bắt đầu

```bash
pnpm install
cp .env.example .env   # điền DATABASE_URL/DIRECT_URL/SUPABASE_* thật
pnpm prisma:generate
pnpm prisma:migrate     # cần DATABASE_URL trỏ tới Supabase project thật, bật extension postgis trước
pnpm start:dev
```

Swagger/OpenAPI tự sinh tại `/api-docs-json` khi server chạy — frontend (Web + Mobile) dùng
`openapi-typescript` trỏ vào URL này để đồng bộ type xuyên repo (mục 2 tài liệu công nghệ FE).

## Tạo admin đầu tiên (Owner)

Chỉ chạy được khi bảng `admin_users` đang trống — xem `tài liệu bussiness.md` §9.9.

```bash
pnpm create-owner --email=you@example.com --password=doi-mat-khau-nay
```

## Ranh giới bảo mật — đọc trước khi thêm route mới

Mọi thao tác GHI (đăng bài, vote, bình luận, report, cập nhật hồ sơ, đăng nhập/OTP...) **bắt buộc qua
NestJS**. Client chỉ được gọi thẳng Supabase cho **1 việc duy nhất**: Realtime đọc bình luận công khai.
OTP KHÔNG dùng Supabase Auth (đổi so với thiết kế ban đầu — NestJS tự quản lý qua eSMS, xem
`tai-lieu-cong-nghe-backend.md` §6). Không có ngoại lệ nào khác.

## Cấu trúc

Xem `tai-lieu-cong-nghe-backend.md` §5 — `src/modules/*` chia theo domain, `src/common/` chứa
guard/decorator/filter dùng chung, `src/integrations/*` bọc riêng từng dịch vụ ngoài.

**Đã cố tình CHƯA bật:** BullMQ/Redis, Read Replica, H3, Cloudflare Images, circuit breaker
(opossum) — chỉ bật khi có bằng chứng traction thật cần, xem `src/jobs/README.md`.
