import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AppealStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { CreatePenaltyAppealDto } from './dto/create-penalty-appeal.dto';

// Khiếu nại phạt oan (tai-lieu-chuc-nang.md #61 mobile + #96 admin) — model PenaltyAppeal có sẵn
// trong schema từ trước nhưng orphaned hoàn toàn (0 service/controller nào dùng). Cơ chế "hoàn tác"
// khi duyệt tái dùng ĐÚNG logic đã có ở UsersService.getDisplayTrustScoresForUsers: chỉ cần tạo 1
// TrustScoreHistory mới sourceType='appeal_reversal' trỏ referenceId về bản ghi vi phạm gốc — hàm
// đó đã tự loại trừ vi phạm khỏi tổng E2 khi thấy referenceId khớp, không cần sửa gì thêm ở đó.
@Injectable()
export class PenaltyAppealsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePenaltyAppealDto) {
    const history = await this.prisma.trustScoreHistory.findUnique({
      where: { id: dto.trustScoreHistoryId },
    });
    if (!history || history.userId !== userId || history.sourceType !== 'violation_confirmed') {
      throw new NotFoundException('Không tìm thấy lần bị trừ điểm này');
    }
    const existing = await this.prisma.penaltyAppeal.findFirst({
      where: { trustScoreHistoryId: dto.trustScoreHistoryId },
    });
    if (existing) {
      throw new BadRequestException('Lần bị trừ điểm này đã được khiếu nại rồi');
    }

    return this.prisma.penaltyAppeal.create({
      data: {
        trustScoreHistoryId: dto.trustScoreHistoryId,
        userId,
        explanation: dto.explanation,
      },
    });
  }

  async listForAdmin(status?: AppealStatus) {
    const rows = await this.prisma.penaltyAppeal.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, alias: true, phoneNumber: true } },
        trustScoreHistory: { select: { delta: true, severity: true, createdAt: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      explanation: r.explanation,
      createdAt: r.createdAt,
      userId: r.user.id,
      userAlias: r.user.alias,
      userPhone: r.user.phoneNumber,
      penaltyDelta: r.trustScoreHistory.delta,
      penaltySeverity: r.trustScoreHistory.severity,
      penaltyAt: r.trustScoreHistory.createdAt,
    }));
  }

  async review(appealId: string, adminId: string, decision: 'approved' | 'rejected') {
    const appeal = await this.prisma.penaltyAppeal.findUnique({ where: { id: appealId } });
    if (!appeal) throw new NotFoundException('Không tìm thấy khiếu nại');
    if (appeal.status !== 'pending') {
      throw new BadRequestException('Khiếu nại này đã được xử lý trước đó');
    }

    if (decision === 'rejected') {
      return this.prisma.penaltyAppeal.update({
        where: { id: appealId },
        data: { status: 'rejected', reviewedByAdminId: adminId },
      });
    }

    const original = await this.prisma.trustScoreHistory.findUniqueOrThrow({
      where: { id: appeal.trustScoreHistoryId },
    });
    const [, updated] = await this.prisma.$transaction([
      this.prisma.trustScoreHistory.create({
        data: {
          userId: appeal.userId,
          delta: Math.abs(original.delta),
          sourceType: 'appeal_reversal',
          referenceId: original.id,
          confirmedByAdminId: adminId,
        },
      }),
      this.prisma.penaltyAppeal.update({
        where: { id: appealId },
        data: { status: 'approved', reviewedByAdminId: adminId },
      }),
    ]);
    return updated;
  }
}
