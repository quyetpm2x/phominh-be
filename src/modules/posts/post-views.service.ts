import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

// Thống kê "ai đã xem bài" (tai-lieu-chuc-nang.md #44) — CHỈ trả TỔNG SỐ, không trả danh sách từng
// người xem (đã chốt với user, đánh đổi quyền riêng tư người xem). Tách khỏi PostsService vì file
// đó đã gần giới hạn 250 dòng.
@Injectable()
export class PostViewsService {
  constructor(private readonly prisma: PrismaService) {}

  // Ghi nhận lượt xem — upsert theo unique [postId, viewerId] nên xem lại nhiều lần vẫn tính 1,
  // không phóng đại số liệu. Gọi mỗi khi client mở màn chi tiết bài.
  async recordView(postId: string, viewerId: string): Promise<void> {
    await this.prisma.postView.upsert({
      where: { postId_viewerId: { postId, viewerId } },
      update: {},
      create: { postId, viewerId },
    });
  }

  // Chỉ merchant là tác giả bài mới xem được (tai-lieu-chuc-nang.md #44 ghi rõ "(merchant)") —
  // không áp dụng cho bài life/emergency.
  async getViewCount(postId: string, requesterId: string): Promise<{ totalViews: number }> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');
    if (post.authorId !== requesterId || post.postType !== 'merchant') {
      throw new ForbiddenException('Chỉ chủ bài (tài khoản quán) mới xem được thống kê lượt xem');
    }
    const totalViews = await this.prisma.postView.count({ where: { postId } });
    return { totalViews };
  }
}
