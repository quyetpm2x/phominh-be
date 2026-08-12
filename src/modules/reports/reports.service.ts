import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Report, ReportStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TrustScoreService } from '../votes/trust-score.service';

import type { CreateReportDto } from './dto/create-report.dto';
import type { UpdateReportStatusDto } from './dto/update-report-status.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScore: TrustScoreService,
  ) {}

  // report KHÔNG tự động trừ điểm — chỉ tạo hàng đợi chờ admin xác nhận (bussiness §4.2b).
  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
    return this.prisma.report.create({
      data: {
        targetType: dto.targetType,
        postId: dto.targetType === 'post' ? dto.targetId : undefined,
        commentId: dto.targetType === 'comment' ? dto.targetId : undefined,
        merchantId: dto.targetType === 'merchant_suspicious' ? dto.targetId : undefined,
        reporterId,
        reason: dto.reason,
        description: dto.description,
      },
    });
  }

  async findQueue(status?: ReportStatus): Promise<Report[]> {
    return this.prisma.report.findMany({ where: { status }, orderBy: { createdAt: 'asc' } });
  }

  // Tầng 2 — chỉ khi ADMIN xác nhận (status='actioned') mới ghi E2 vào trust_score_history, đúng
  // nguyên tắc "report không tự động trừ điểm" (bussiness §4.2b).
  async updateStatus(
    reportId: string,
    adminId: string,
    dto: UpdateReportStatusDto,
  ): Promise<Report> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Không tìm thấy report');

    if (dto.status === 'actioned') {
      if (!dto.severity)
        throw new BadRequestException('Cần chọn severity khi xác nhận vi phạm (actioned)');
      await this.applyPenalty(report, dto.severity, dto.severityScore ?? 0.5);
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status: dto.status, reviewedByAdminId: adminId },
    });
  }

  private async applyPenalty(
    report: Report,
    severity: 'light' | 'medium' | 'severe',
    severityScore: number,
  ): Promise<void> {
    const violatorId = await this.resolveViolatorId(report);
    if (!violatorId) return;

    const violator = await this.prisma.user.findUniqueOrThrow({ where: { id: violatorId } });
    const tier = this.trustScore.getBadgeTier(violator.trustScoreE1);
    const penalty = this.trustScore.calculatePenalty(tier, severity, severityScore);

    await this.prisma.$transaction([
      this.prisma.trustScoreHistory.create({
        data: {
          userId: violatorId,
          delta: -penalty,
          sourceType: 'violation_confirmed',
          referenceId: report.id,
          confirmedByAdminId: report.reviewedByAdminId,
        },
      }),
      // Lưu ý: E1 KHÔNG trừ trực tiếp ở đây — E2_hiệu_lực tính runtime qua
      // UsersService.getDisplayTrustScore và tự phai theo 180 ngày (bussiness §4.2b/d).
    ]);
  }

  private async resolveViolatorId(report: Report): Promise<string | null> {
    if (report.postId) {
      const post = await this.prisma.post.findUnique({
        where: { id: report.postId },
        select: { authorId: true },
      });
      return post?.authorId ?? null;
    }
    if (report.commentId) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: report.commentId },
        select: { authorId: true },
      });
      return comment?.authorId ?? null;
    }
    if (report.merchantId) {
      const merchant = await this.prisma.merchantProfile.findUnique({
        where: { id: report.merchantId },
        select: { userId: true },
      });
      return merchant?.userId ?? null;
    }
    return null;
  }
}
