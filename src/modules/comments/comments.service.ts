import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Comment, CommentVisibility } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VotesService } from '../votes/votes.service';

import type { CreateCommentDto } from './dto/create-comment.dto';
import type { UpdateCommentDto } from './dto/update-comment.dto';

// ĐÃ GIẢM từ 48h xuống 24h (bussiness §4.1 quy tắc 2, cập nhật) — chọn cận dưới của khoảng gốc
// 48-72h ban đầu, giờ giảm tiếp xuống 24h theo quyết định mới nhất.
const MIN_ACCOUNT_AGE_HOURS_TO_COMMENT_ON_OTHERS = 24;

export interface CommentSummary {
  id: string;
  postId: string;
  authorId: string;
  authorDisplayName: string;
  content: string;
  visibility: CommentVisibility;
  isPinned: boolean;
  voteCount: number;
  hasVoted: boolean;
  createdAt: Date;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly votesService: VotesService,
  ) {}

  async create(postId: string, authorId: string, dto: CreateCommentDto): Promise<Comment> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');

    if (post.authorId !== authorId) {
      await this.assertAccountOldEnough(authorId);
    }

    // TODO(moderation): phát hiện cụm tấn công (5 bình luận tiêu cực/10 phút → tạm khoá 1-2h, tạo
    // CommentAttackIncident) chưa implement — cần phân loại "tiêu cực" (Vision/NLP hoặc report dồn
    // dập), để ở modules/moderation.
    //
    // ĐÃ BỎ (bussiness §4.1 quy tắc 3, cập nhật): trước đây tự động isHidden=true cho bình luận từ
    // tài khoản điểm uy tín thấp (tier 0). Giờ mọi bình luận hợp lệ luôn hiện — chủ bài vẫn tự ẩn
    // tay được qua setHiddenByOwner() (quy tắc 1, không đổi).
    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId,
        content: dto.content,
        visibility: dto.visibility ?? 'public',
        isHidden: false,
      },
    });
    await this.prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });
    if (post.authorId !== authorId) {
      await this.notifyPostOwner(postId, post.authorId, authorId, comment.content);
    }
    return comment;
  }

  // Thông báo bình luận mới (tai-lieu-chuc-nang.md #47/#48) — tôn trọng cờ notifyComments (mặc
  // định bật), kể cả bình luận riêng tư (visibility='private') vẫn báo, vì đó CHÍNH LÀ kênh chủ bài
  // biết có người hỏi riêng.
  private async notifyPostOwner(
    postId: string,
    postAuthorId: string,
    commenterId: string,
    content: string,
  ): Promise<void> {
    const setting = await this.prisma.notificationDigestSetting.findUnique({
      where: { userId: postAuthorId },
    });
    if (setting && !setting.notifyComments) return;

    const commenter = await this.prisma.user.findUniqueOrThrow({ where: { id: commenterId } });
    const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;
    await this.notifications.createNotification(
      postAuthorId,
      'comment_on_post',
      `${commenter.alias} vừa bình luận trên bài của bạn`,
      preview,
      postId,
    );
  }

  async findForPost(postId: string, viewerId: string): Promise<CommentSummary[]> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');

    const isOwner = post.authorId === viewerId;
    const comments = await this.prisma.comment.findMany({
      where: {
        postId,
        // Bình luận bị chủ bài tự ẩn (setHiddenByOwner) không hiện cho ai — kể cả chủ bài, vì UI
        // hiện không có màn riêng để xem/khôi phục bình luận đã ẩn. (Không còn tự động ẩn theo
        // điểm uy tín thấp — bussiness §4.1 quy tắc 3 đã bỏ.)
        isHidden: false,
        // Bình luận riêng tư chỉ chủ bài thấy (bussiness §9.2 B3) — người khác chỉ thấy public.
        visibility: isOwner ? undefined : 'public',
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }],
      // Comment KHÔNG có field displayMode như Post — luôn hiện theo bí danh, không có lựa chọn tên thật.
      // Comment không có cột voteCount cache như Post (schema.prisma) — đếm qua _count tại đây.
      include: { author: { select: { alias: true } }, _count: { select: { votes: true } } },
    });

    const votedIds = await this.votesService.getVotedTargetIds(
      viewerId,
      'comment',
      comments.map((c) => c.id),
    );

    return comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      authorDisplayName: c.author.alias,
      content: c.content,
      visibility: c.visibility,
      isPinned: c.isPinned,
      voteCount: c._count.votes,
      hasVoted: votedIds.has(c.id),
      createdAt: c.createdAt,
    }));
  }

  async setPinned(
    postId: string,
    commentId: string,
    ownerId: string,
    isPinned: boolean,
  ): Promise<Comment> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');
    if (post.authorId !== ownerId) {
      throw new ForbiddenException(
        'Chỉ chủ bài mới được ghim bình luận (bussiness §4.1 quy tắc 1)',
      );
    }
    return this.prisma.comment.update({ where: { id: commentId }, data: { isPinned } });
  }

  async setHiddenByOwner(
    postId: string,
    commentId: string,
    ownerId: string,
    isHidden: boolean,
  ): Promise<Comment> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');
    if (post.authorId !== ownerId) {
      throw new ForbiddenException('Chỉ chủ bài mới được ẩn/xoá bình luận trên bài của mình');
    }
    return this.prisma.comment.update({ where: { id: commentId }, data: { isHidden } });
  }

  // Sửa bình luận của chính mình (tai-lieu-chuc-nang.md #34) — không giới hạn chỉ tác giả mới sửa
  // được nội dung, không đụng isPinned/isHidden (thuộc quyền chủ bài).
  async updateOwn(commentId: string, authorId: string, dto: UpdateCommentDto): Promise<Comment> {
    const comment = await this.findOwnComment(commentId, authorId);
    return this.prisma.comment.update({
      where: { id: comment.id },
      data: { content: dto.content },
    });
  }

  // Xoá bình luận của chính mình — dùng chung field isHidden với setHiddenByOwner (xem comment trên
  // Comment.isHidden trong schema.prisma vì sao 2 hành động khác actor lại chung 1 field).
  async deleteOwn(commentId: string, authorId: string): Promise<void> {
    const comment = await this.findOwnComment(commentId, authorId);
    await this.prisma.comment.update({ where: { id: comment.id }, data: { isHidden: true } });
  }

  private async findOwnComment(commentId: string, authorId: string): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.isHidden) throw new NotFoundException('Không tìm thấy bình luận');
    if (comment.authorId !== authorId) {
      throw new ForbiddenException('Chỉ tác giả mới được sửa/xoá bình luận này');
    }
    return comment;
  }

  private async assertAccountOldEnough(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ageHours = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < MIN_ACCOUNT_AGE_HOURS_TO_COMMENT_ON_OTHERS) {
      throw new ForbiddenException(
        `Tài khoản cần đủ ${MIN_ACCOUNT_AGE_HOURS_TO_COMMENT_ON_OTHERS} giờ mới được bình luận vào bài người khác`,
      );
    }
  }
}
