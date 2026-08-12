import type { PostStatus } from '@prisma/client';

// Tách riêng khỏi service để test thuần không cần mock Prisma (tai-lieu-chuc-nang.md #33 "trước khi
// hết hạn") — dùng chung cho cả sửa và xoá, 2 hành động có cùng điều kiện.
export function isPostModifiable(
  post: { status: PostStatus; expiresAt: Date | null },
  now: Date,
): boolean {
  if (post.status !== 'active') return false;
  return post.expiresAt === null || post.expiresAt > now;
}
