-- Reply lồng nhau 1 cấp cho bình luận (bổ sung ngoài 117 mục gốc, xem tai-lieu-chuc-nang.md mục
-- 120). ON DELETE CASCADE để xoá bình luận cha (hiếm, hiện chỉ soft-delete qua isHidden) tự dọn
-- theo replies, tránh orphan row.
ALTER TABLE "comments" ADD COLUMN "parent_comment_id" UUID;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_parent_comment_id_fkey"
  FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "comments_parent_comment_id_idx" ON "comments"("parent_comment_id");
