-- Seed permission "view_posts" cho tính năng Quản lý bài đăng (ngoài phạm vi 117 mục gốc, xem
-- tai-lieu-chuc-nang.md mục 120). create-owner.ts chỉ seed permissions lúc admin_users còn trống
-- nên permission mới thêm sau khi đã có Owner phải chèn thủ công qua migration.
INSERT INTO "permissions" ("id", "permission_key", "label", "group_name")
VALUES (gen_random_uuid(), 'view_posts', 'Xem danh sách bài đăng', 'Nội dung')
ON CONFLICT ("permission_key") DO NOTHING;
