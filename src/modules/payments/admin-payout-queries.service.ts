import { Injectable } from '@nestjs/common';
import type { PayoutRequest, PayoutStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { requiresManualAdminApproval } from '../rewards/reward-payout.util';

export interface AdminPayoutItem {
  id: string;
  userId: string;
  userAlias: string;
  userPhoneNumber: string;
  amount: number;
  source: PayoutRequest['source'];
  status: PayoutStatus;
  bankCode: string;
  accountHolderName: string;
  providerTransactionId: string | null;
  createdAt: Date;
  requiresManualApproval: boolean;
}

@Injectable()
export class AdminPayoutQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  // Hàng đợi duyệt chi hộ cho admin (tai-lieu-chuc-nang.md #115) — trước đây KHÔNG có route liệt kê
  // nào, chỉ có PATCH .../process gọi tay qua id đã biết trước, nên payout đứng yên vô thời hạn vì
  // không ai thấy để duyệt. requiresManualApproval tính lại tại thời điểm xem (không lưu cột riêng)
  // dựa trên SỐ LẦN rút thành công TRƯỚC ĐÓ của user — đúng logic gốc ở PaymentsService.requestPayout().
  async listPayoutRequests(status?: PayoutStatus): Promise<AdminPayoutItem[]> {
    const payouts = await this.prisma.payoutRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { alias: true, phoneNumber: true } },
        bankAccount: { select: { bankCode: true, accountHolderName: true } },
      },
    });

    const successCounts = await this.prisma.payoutRequest.groupBy({
      by: ['userId'],
      where: { status: 'success' },
      _count: { _all: true },
    });
    const successCountByUser = new Map(successCounts.map((s) => [s.userId, s._count._all]));

    return payouts.map((p) => {
      const ownSuccessCount = p.status === 'success' ? 1 : 0;
      const priorSuccessCount = (successCountByUser.get(p.userId) ?? 0) - ownSuccessCount;
      return {
        id: p.id,
        userId: p.userId,
        userAlias: p.user.alias,
        userPhoneNumber: p.user.phoneNumber,
        amount: p.amount,
        source: p.source,
        status: p.status,
        bankCode: p.bankAccount.bankCode,
        accountHolderName: p.bankAccount.accountHolderName,
        providerTransactionId: p.providerTransactionId,
        createdAt: p.createdAt,
        requiresManualApproval: requiresManualAdminApproval(p.amount, priorSuccessCount === 0),
      };
    });
  }
}
