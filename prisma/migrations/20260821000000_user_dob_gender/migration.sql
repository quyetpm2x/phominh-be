-- Ngày sinh + giới tính, bắt buộc điền lúc onboarding (bổ sung ngoài 117 mục gốc, quyết định
-- 2026-08-20) — cột nullable vì user cũ chưa có dữ liệu, FE tự tính "đã điền đủ hồ sơ" runtime.
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

ALTER TABLE "users" ADD COLUMN "date_of_birth" DATE;
ALTER TABLE "users" ADD COLUMN "gender" "Gender";
