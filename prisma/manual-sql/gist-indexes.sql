-- Chạy 1 lần SAU KHI `pnpm prisma:migrate` đã tạo xong bảng, trên đúng DB Supabase thật
-- (vd: psql "$DIRECT_URL" -f prisma/manual-sql/gist-indexes.sql, hoặc dán vào Supabase SQL Editor).
--
-- Prisma Migrate không tự sinh được index kiểu GiST cho cột geography — bắt buộc thêm tay theo
-- tai-lieu-cong-nghe-backend.md §11 ("Index GiST bắt buộc trên mọi cột geography — thiếu index là
-- nguyên nhân nghẽn phổ biến nhất"). Nhớ bật extension PostGIS trước khi migrate lần đầu:
--   create extension if not exists postgis;

create index if not exists posts_posted_location_gist
  on posts using gist (posted_location);

create index if not exists fixed_areas_location_gist
  on fixed_areas using gist (location);

create index if not exists merchant_profiles_location_gist
  on merchant_profiles using gist (location);
