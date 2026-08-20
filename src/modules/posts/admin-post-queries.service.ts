import { Injectable, NotFoundException } from '@nestjs/common';
import type { CommentVisibility, PostStatus, PostType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { buildCommentTree } from '../comments/comment-tree.util';

const PAGE_SIZE = 30;

export interface AdminPostListItem {
  id: string;
  content: string;
  postType: PostType;
  status: PostStatus;
  authorId: string;
  authorAlias: string;
  imageCount: number;
  voteCount: number;
  commentCount: number;
  isSeeded: boolean;
  createdAt: Date;
}

export interface AdminPostListResult {
  items: AdminPostListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface AdminCommentNode {
  id: string;
  authorAlias: string;
  authorRealName: string | null;
  // Bình luận riêng tư KHÔNG trả content ở đây — cùng nguyên tắc bảo vệ với B3 (mục 88, "nhạy
  // cảm nhất", bắt buộc ghi lý do trước khi xem qua reveal-private-comment riêng), màn quản lý
  // bài đăng này không có cơ chế ghi lý do nên không mở khoá nội dung riêng tư.
  content: string | null;
  visibility: CommentVisibility;
  isHidden: boolean;
  parentCommentId: string | null;
  createdAt: Date;
  replies: AdminCommentNode[];
}

export interface AdminPostDetail extends AdminPostListItem {
  authorRealName: string | null;
  images: { id: string; url: string }[];
  comments: AdminCommentNode[];
}

// Danh sách + chi tiết + ẩn bài đăng cho admin — ngoài phạm vi 117 mục gốc, bổ sung theo yêu cầu
// quản lý nội dung (tai-lieu-chuc-nang.md mục 120). Sort mặc định theo thời gian đăng mới nhất.
// Ẩn bài ở đây KHÔNG áp dụng phạt điểm uy tín tác giả (khác luồng report B1/ReportsService — ở đó
// admin xác nhận VI PHẠM nên mới trừ điểm; ở đây admin chỉ đang ẩn nội dung trực tiếp, chưa hẳn là
// buộc tội tác giả — muốn phạt điểm thì dùng đúng luồng report).
@Injectable()
export class AdminPostQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1): Promise<AdminPostListResult> {
    const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { author: { select: { alias: true } }, _count: { select: { images: true } } },
      }),
      this.prisma.post.count(),
    ]);

    return {
      items: posts.map((p) => this.toListItem(p)),
      total,
      page: safePage,
      pageSize: PAGE_SIZE,
    };
  }

  async getDetail(id: string): Promise<AdminPostDetail> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { alias: true, realName: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { alias: true, realName: true } } },
        },
        _count: { select: { images: true } },
      },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');

    const flatComments = post.comments.map((c) => ({
      id: c.id,
      authorAlias: c.author.alias,
      authorRealName: c.author.realName,
      content: c.visibility === 'private' ? null : c.content,
      visibility: c.visibility,
      isHidden: c.isHidden,
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt,
      replies: [] as AdminCommentNode[],
    }));

    return {
      ...this.toListItem(post),
      authorRealName: post.author.realName,
      images: post.images.map((img) => ({ id: img.id, url: img.url })),
      comments: buildCommentTree(flatComments),
    };
  }

  // Bắt buộc ghi lý do (HidePostDto) — ghi vào AdminActionLog để truy vết sau này, cùng pattern
  // create_admin/update_admin_permissions ở admin.service.ts.
  async hide(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<{ id: string; status: PostStatus }> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');

    const updated = await this.prisma.post.update({
      where: { id },
      data: { status: 'removed' },
    });
    await this.prisma.adminActionLog.create({
      data: {
        adminUserId: adminId,
        action: 'hide_post',
        targetType: 'post',
        targetId: id,
        metadata: { reason },
      },
    });
    return { id: updated.id, status: updated.status };
  }

  private toListItem(p: {
    id: string;
    content: string;
    postType: PostType;
    status: PostStatus;
    authorId: string;
    author: { alias: string };
    _count: { images: number };
    voteCount: number;
    commentCount: number;
    isSeeded: boolean;
    createdAt: Date;
  }): AdminPostListItem {
    return {
      id: p.id,
      content: p.content,
      postType: p.postType,
      status: p.status,
      authorId: p.authorId,
      authorAlias: p.author.alias,
      imageCount: p._count.images,
      voteCount: p.voteCount,
      commentCount: p.commentCount,
      isSeeded: p.isSeeded,
      createdAt: p.createdAt,
    };
  }
}
