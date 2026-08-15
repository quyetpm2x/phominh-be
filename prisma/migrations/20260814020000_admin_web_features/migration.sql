-- Đánh dấu tình huống khẩn cấp đã được xử lý xong (tai-lieu-chuc-nang.md #90)
ALTER TABLE "posts" ADD COLUMN "emergency_resolved_at" TIMESTAMP(3);
