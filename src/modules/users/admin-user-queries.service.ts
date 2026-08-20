import { Injectable, NotFoundException } from '@nestjs/common';
import type { AccountStatus, User } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TrustScoreService } from '../votes/trust-score.service';

const PAGE_SIZE = 30;
const TRUST_HISTORY_LIMIT = 20;

export interface AdminUserListItem {
  id: string;
  alias: string;
  phoneNumber: string;
  accountStatus: AccountStatus;
  trustScoreE1: number;
  trustBadgeLabel: string;
  postCount: number;
  createdAt: Date;
}

export interface AdminUserListResult {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserDetail extends AdminUserListItem {
  realName: string | null;
  statusReason: string | null;
  postCount: number;
  commentCount: number;
  reportsReceivedCount: number;
  reportsSentCount: number;
  trustHistory: {
    id: string;
    delta: number;
    sourceType: string;
    severity: string | null;
    createdAt: Date;
  }[];
}

// Danh sách + chi tiết người dùng cho admin (tai-lieu-chuc-nang.md #91/#92) — trước đây backend
// KHÔNG có route nào, dù permission `view_users` đã seed sẵn từ trước (scripts/create-owner.ts).
// KHÔNG dựng lại phần "cụm vote"/"cùng thiết bị" trong mock gốc — đó thuộc phát hiện thông đồng vote
// (mục 93/7e), đã HOÃN CÓ CHỦ Ý theo quyết định người dùng, không bịa dữ liệu giả cho phần đó.
@Injectable()
export class AdminUserQueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScore: TrustScoreService,
  ) {}

  // Phân trang offset (page/pageSize) — đủ dùng ở quy mô vài trăm user (tai-lieu-chuc-nang.md #91),
  // chưa cần cursor-based cho quy mô lớn hơn nhiều.
  async search(query?: string, page = 1): Promise<AdminUserListResult> {
    const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    const where = query
      ? {
          OR: [
            { phoneNumber: { contains: query } },
            { alias: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { _count: { select: { posts: { where: { status: 'active' } } } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => this.toListItem(u)),
      total,
      page: safePage,
      pageSize: PAGE_SIZE,
    };
  }

  // Bắt buộc ghi lý do trước khi xem (mục 92, cùng pattern reveal-private-comment #88) — ghi vào
  // SensitiveDataAccessLog trước khi trả dữ liệu.
  async revealDetail(adminId: string, userId: string, reason: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const [postCount, commentCount, reportsReceivedCount, reportsSentCount, trustHistory] =
      await Promise.all([
        this.prisma.post.count({ where: { authorId: userId, status: 'active' } }),
        this.prisma.comment.count({ where: { authorId: userId, isHidden: false } }),
        this.prisma.report.count({
          where: { OR: [{ post: { authorId: userId } }, { comment: { authorId: userId } }] },
        }),
        this.prisma.report.count({ where: { reporterId: userId } }),
        this.prisma.trustScoreHistory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: TRUST_HISTORY_LIMIT,
        }),
      ]);

    await this.prisma.sensitiveDataAccessLog.create({
      data: { adminUserId: adminId, dataType: 'user_detail', targetId: userId, reason },
    });

    return {
      ...this.toListItem(user),
      realName: user.realName,
      statusReason: user.statusReason,
      postCount,
      commentCount,
      reportsReceivedCount,
      reportsSentCount,
      trustHistory: trustHistory.map((h) => ({
        id: h.id,
        delta: h.delta,
        sourceType: h.sourceType,
        severity: h.severity,
        createdAt: h.createdAt,
      })),
    };
  }

  private toListItem(u: User & { _count?: { posts: number } }): AdminUserListItem {
    return {
      id: u.id,
      alias: u.alias,
      phoneNumber: u.phoneNumber,
      accountStatus: u.accountStatus,
      trustScoreE1: u.trustScoreE1,
      trustBadgeLabel: this.trustScore.getBadgeLabel(this.trustScore.getBadgeTier(u.trustScoreE1)),
      postCount: u._count?.posts ?? 0,
      createdAt: u.createdAt,
    };
  }
}
