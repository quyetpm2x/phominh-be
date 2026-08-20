import { Injectable, NotFoundException } from '@nestjs/common';
import type { CollaboratorKpiTarget } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { SetKpiTargetDto } from './dto/set-kpi-target.dto';

export interface CollaboratorItem {
  id: string;
  alias: string;
  phoneNumber: string;
  createdAt: Date;
}

export interface CollaboratorStatsItem extends CollaboratorItem {
  postsCount: number;
  votesCount: number;
  commentsCount: number;
  postsTarget: number;
  votesTarget: number;
  commentsTarget: number;
  // Giờ (0-23) có nhiều lượt mở app nhất trong kỳ đang xem — null nếu không mở app lần nào. Chỉ
  // dùng app_sessions.opened_at (tín hiệu "hoạt động" sạch nhất, cùng nguồn với G1/hệ số hoạt động
  // bussiness §4.2c) — KHÔNG suy ra được "bao nhiêu giờ/ngày" vì app_sessions không ghi lúc đóng app.
  peakHour: number | null;
}

// Cộng tác viên (ngoài phạm vi tài liệu chức năng gốc — bổ sung theo yêu cầu vận hành, thảo luận
// 2026-08-17): tài khoản THẬT tự đăng ký qua OTP như user thường, admin chỉ ĐÁNH DẤU sau. Cờ
// isCollaborator thuần nội bộ — dùng để loại khỏi rút thưởng thật/leaderboard/số liệu tăng trưởng
// (xem PaymentsService.requestPayout, LeaderboardSnapshotCronService, AnalyticsService).
@Injectable()
export class CollaboratorsService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản này');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isCollaborator: true } }),
      this.prisma.collaboratorKpiTarget.upsert({
        where: { userId },
        update: {},
        create: { userId },
      }),
    ]);
  }

  async unmark(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { isCollaborator: false } });
  }

  async setKpiTarget(userId: string, dto: SetKpiTargetDto): Promise<CollaboratorKpiTarget> {
    return this.prisma.collaboratorKpiTarget.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async listWithStats(dateFrom: Date, dateTo: Date): Promise<CollaboratorStatsItem[]> {
    const collaborators = await this.prisma.user.findMany({
      where: { isCollaborator: true },
      include: { collaboratorKpiTarget: true },
      orderBy: { createdAt: 'asc' },
    });
    if (collaborators.length === 0) return [];
    const ids = collaborators.map((c) => c.id);

    const [posts, votes, comments, peakHours] = await Promise.all([
      this.prisma.post.groupBy({
        by: ['authorId'],
        where: { authorId: { in: ids }, createdAt: { gte: dateFrom, lt: dateTo } },
        _count: { _all: true },
      }),
      this.prisma.vote.groupBy({
        by: ['voterId'],
        where: { voterId: { in: ids }, createdAt: { gte: dateFrom, lt: dateTo } },
        _count: { _all: true },
      }),
      this.prisma.comment.groupBy({
        by: ['authorId'],
        where: { authorId: { in: ids }, createdAt: { gte: dateFrom, lt: dateTo } },
        _count: { _all: true },
      }),
      this.getPeakHours(ids, dateFrom, dateTo),
    ]);
    const postsByUser = new Map(posts.map((p) => [p.authorId, p._count._all]));
    const votesByUser = new Map(votes.map((v) => [v.voterId, v._count._all]));
    const commentsByUser = new Map(comments.map((c) => [c.authorId, c._count._all]));

    return collaborators.map((c) => ({
      id: c.id,
      alias: c.alias,
      phoneNumber: c.phoneNumber,
      createdAt: c.createdAt,
      postsCount: postsByUser.get(c.id) ?? 0,
      votesCount: votesByUser.get(c.id) ?? 0,
      commentsCount: commentsByUser.get(c.id) ?? 0,
      postsTarget: c.collaboratorKpiTarget?.postsTarget ?? 0,
      votesTarget: c.collaboratorKpiTarget?.votesTarget ?? 0,
      commentsTarget: c.collaboratorKpiTarget?.commentsTarget ?? 0,
      peakHour: peakHours.get(c.id) ?? null,
    }));
  }

  private async getPeakHours(
    userIds: string[],
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<Array<{ user_id: string; hour: number; cnt: bigint }>>`
      select user_id, extract(hour from opened_at)::int as hour, count(*) as cnt
      from app_sessions
      where user_id = ANY(${userIds}::uuid[]) and opened_at >= ${dateFrom} and opened_at < ${dateTo}
      group by user_id, hour
    `;
    const best = new Map<string, { hour: number; cnt: number }>();
    for (const r of rows) {
      const cnt = Number(r.cnt);
      const current = best.get(r.user_id);
      if (!current || cnt > current.cnt) best.set(r.user_id, { hour: r.hour, cnt });
    }
    return new Map([...best].map(([userId, v]) => [userId, v.hour]));
  }
}
