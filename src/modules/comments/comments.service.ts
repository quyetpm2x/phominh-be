import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Comment, CommentVisibility } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VotesService } from '../votes/votes.service';

import { buildCommentTree } from './comment-tree.util';
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
  parentCommentId: string | null;
  createdAt: Date;
  replies: CommentSummary[];
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

    const parentCommentId = await this.resolveParentCommentId(postId, dto.parentCommentId);

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
        parentCommentId,
      },
    });
    await this.prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });
    if (post.authorId !== authorId) {
      await this.notifyPostOwner(postId, post.authorId, authorId, comment.content);
    }
    if (parentCommentId) {
      await this.notifyParentCommentAuthor(
        parentCommentId,
        postId,
        post.authorId,
        authorId,
        comment.content,
      );
    }
    return comment;
  }

  // Reply lồng nhau CHỈ 1 cấp (quyết định 2026-08-20) — trả lời 1 reply tự "phẳng hoá" về đúng bình
  // luận GỐC (ông/bà thay vì cha), tránh chuỗi lồng sâu vô hạn ở UI mobile. Mobile app cũng không
  // hiện nút "Trả lời" trên reply (chỉ trên bình luận gốc) nên nhánh flatten này chủ yếu là lưới an
  // toàn phòng race-condition/nhiều client.
  private async resolveParentCommentId(
    postId: string,
    parentCommentId?: string,
  ): Promise<string | null> {
    if (!parentCommentId) return null;
    const parent = await this.prisma.comment.findUnique({ where: { id: parentCommentId } });
    if (!parent || parent.postId !== postId) {
      throw new NotFoundException('Không tìm thấy bình luận đang trả lời');
    }
    return parent.parentCommentId ?? parent.id;
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

  // Thông báo riêng cho tác giả bình luận GỐC khi có reply — bỏ qua nếu tự trả lời chính mình hoặc
  // nếu tác giả đó chính là chủ bài (đã nhận notifyPostOwner ở trên rồi, tránh báo trùng 2 lần).
  private async notifyParentCommentAuthor(
    parentCommentId: string,
    postId: string,
    postAuthorId: string,
    replierId: string,
    content: string,
  ): Promise<void> {
    const parent = await this.prisma.comment.findUnique({ where: { id: parentCommentId } });
    if (!parent || parent.authorId === replierId || parent.authorId === postAuthorId) return;

    const setting = await this.prisma.notificationDigestSetting.findUnique({
      where: { userId: parent.authorId },
    });
    if (setting && !setting.notifyComments) return;

    const replier = await this.prisma.user.findUniqueOrThrow({ where: { id: replierId } });
    const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;
    await this.notifications.createNotification(
      parent.authorId,
      'reply_on_comment',
      `${replier.alias} đã trả lời bình luận của bạn`,
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

    const flat: CommentSummary[] = comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      authorDisplayName: c.author.alias,
      content: c.content,
      visibility: c.visibility,
      isPinned: c.isPinned,
      voteCount: c._count.votes,
      hasVoted: votedIds.has(c.id),
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt,
      replies: [],
    }));

    return buildCommentTree(flat);
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
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { isHidden },
    });
    if (isHidden) await this.cascadeHideReplies(commentId);
    return updated;
  }

  // Admin ẩn bình luận bất kỳ trên toàn hệ thống — ngoài phạm vi 117 mục gốc, mở rộng cùng mục 120
  // (quản lý bài đăng). Khác setHiddenByOwner (chỉ chủ bài trên bài của chính mình). Bắt buộc ghi
  // lý do (HideCommentDto), ghi vào AdminActionLog.
  async adminHide(commentId: string, adminId: string, reason: string): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { isHidden: true },
    });
    await this.cascadeHideReplies(commentId);
    await this.prisma.adminActionLog.create({
      data: {
        adminUserId: adminId,
        action: 'hide_comment',
        targetType: 'comment',
        targetId: commentId,
        metadata: { reason },
      },
    });
    return updated;
  }

  // Ẩn 1 bình luận GỐC tự động ẩn theo mọi reply trực tiếp — không cần đệ quy sâu hơn vì reply chỉ
  // lồng 1 cấp (xem resolveParentCommentId).
  private async cascadeHideReplies(commentId: string): Promise<void> {
    await this.prisma.comment.updateMany({
      where: { parentCommentId: commentId },
      data: { isHidden: true },
    });
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
    await this.cascadeHideReplies(comment.id);
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
