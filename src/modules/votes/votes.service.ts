import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Vote } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

import type { CastVoteDto } from './dto/cast-vote.dto';
import { TrustScoreService } from './trust-score.service';

// ĐÃ GIẢM từ 48h xuống 24h (bussiness §4.2a quy tắc 1, cập nhật) — khớp với ngưỡng bình luận
// (comments.service.ts) sau khi 2 ngưỡng được thống nhất lại thành 1 con số duy nhất.
const MIN_ACCOUNT_AGE_HOURS_TO_VOTE = 24;

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScore: TrustScoreService,
    private readonly usersService: UsersService,
  ) {}

  // TODO: quy tắc 3 (giới hạn tần suất vote liên tục cho cùng 1 người) — áp @nestjs/throttler ở
  // controller khi có traction thật để tinh chỉnh ngưỡng theo dữ liệu, chưa cứng ở đây.
  // TODO: quy tắc 4 (rà soát cụm vote qua lại thông đồng, graph-based) — xem modules/moderation.
  async castVote(voterId: string, dto: CastVoteDto): Promise<Vote> {
    const { authorId } = await this.resolveTargetAuthor(dto.targetType, dto.targetId);
    if (authorId === voterId) {
      throw new BadRequestException('Không thể tự vote cho bài/bình luận của chính mình');
    }

    await this.assertVoterEligible(voterId);
    await this.assertNotAlreadyVoted(voterId, dto);

    const weight = await this.computeVoteWeight(voterId);

    return this.prisma.$transaction(async (tx) => {
      const vote = await tx.vote.create({
        data: {
          targetType: dto.targetType,
          postId: dto.targetType === 'post' ? dto.targetId : null,
          commentId: dto.targetType === 'comment' ? dto.targetId : null,
          voterId,
          weightApplied: weight,
        },
      });

      if (dto.targetType === 'post') {
        await tx.post.update({
          where: { id: dto.targetId },
          data: { voteCount: { increment: 1 } },
        });
      }

      await tx.trustScoreHistory.create({
        data: { userId: authorId, delta: weight, sourceType: 'vote', referenceId: vote.id },
      });
      await tx.user.update({
        where: { id: authorId },
        data: { trustScoreE1: { increment: weight } },
      });

      return vote;
    });
  }

  private async resolveTargetAuthor(
    targetType: 'post' | 'comment',
    targetId: string,
  ): Promise<{ authorId: string }> {
    if (targetType === 'post') {
      const post = await this.prisma.post.findUnique({
        where: { id: targetId },
        select: { authorId: true },
      });
      if (!post) throw new NotFoundException('Không tìm thấy bài đăng');
      return { authorId: post.authorId };
    }
    const comment = await this.prisma.comment.findUnique({
      where: { id: targetId },
      select: { authorId: true },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận');
    return { authorId: comment.authorId };
  }

  private async assertVoterEligible(voterId: string): Promise<void> {
    const voter = await this.prisma.user.findUniqueOrThrow({ where: { id: voterId } });
    const ageHours = (Date.now() - voter.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < MIN_ACCOUNT_AGE_HOURS_TO_VOTE) {
      throw new ForbiddenException(
        `Tài khoản cần đủ ${MIN_ACCOUNT_AGE_HOURS_TO_VOTE} giờ mới được vote`,
      );
    }
  }

  private async assertNotAlreadyVoted(voterId: string, dto: CastVoteDto): Promise<void> {
    const existing = await this.prisma.vote.findFirst({
      where: {
        voterId,
        postId: dto.targetType === 'post' ? dto.targetId : undefined,
        commentId: dto.targetType === 'comment' ? dto.targetId : undefined,
      },
    });
    if (existing) throw new BadRequestException('Bạn đã vote cho mục này rồi');
  }

  private async computeVoteWeight(voterId: string): Promise<number> {
    const [displayScore, lastSession] = await Promise.all([
      this.usersService.getDisplayTrustScore(voterId),
      this.prisma.appSession.findFirst({
        where: { userId: voterId },
        orderBy: { openedAt: 'desc' },
      }),
    ]);
    const lastAppSessionAt = lastSession?.openedAt ?? new Date();
    return this.trustScore.calculateVoteWeight(displayScore, lastAppSessionAt);
  }
}
