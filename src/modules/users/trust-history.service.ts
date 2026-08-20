import { Injectable } from '@nestjs/common';
import type { AppealStatus, TrustScoreSourceType, ViolationSeverity } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const HISTORY_LIMIT = 50;

export interface TrustHistoryItem {
  id: string;
  delta: number;
  sourceType: TrustScoreSourceType;
  severity: ViolationSeverity | null;
  createdAt: Date;
  // Chỉ có giá trị khi sourceType = violation_confirmed — cho FE biết còn khiếu nại được không
  // (tai-lieu-chuc-nang.md #61). null = chưa từng khiếu nại lần trừ điểm này.
  appealStatus: AppealStatus | null;
}

// Xem lịch sử điểm uy tín đầy đủ, cả tăng E1 lẫn giảm E2 (tai-lieu-chuc-nang.md #62) — tách riêng
// khỏi UsersService (đã gần giới hạn 250 dòng). TrustScoreHistory trước đây chỉ đọc NỘI BỘ để tính
// E2 hiệu lực (UsersService.getDisplayTrustScoresForUsers), chưa có endpoint nào trả lại cho chính
// user xem. Đây là lịch sử CỦA CHÍNH USER xem — khác nguyên tắc "không hiện điểm số thô cho người
// khác" (mục 17), user có quyền biết chi tiết điểm của chính mình.
@Injectable()
export class TrustHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyHistory(userId: string): Promise<TrustHistoryItem[]> {
    const rows = await this.prisma.trustScoreHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      include: {
        penaltyAppeals: { select: { status: true }, take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      sourceType: r.sourceType,
      severity: r.severity,
      createdAt: r.createdAt,
      appealStatus: r.penaltyAppeals[0]?.status ?? null,
    }));
  }
}
