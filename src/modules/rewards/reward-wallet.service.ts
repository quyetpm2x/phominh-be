import { Injectable } from '@nestjs/common';
import type { RewardLedger, RewardLedgerType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const RECENT_LEDGER_LIMIT = 20;

// Ví thưởng dùng CHUNG cho leaderboard/referral/payout (bussiness §5.1) — amount tính bằng ĐỒNG, có
// thể âm (payout đã rút, trừ ngược điểm khẩn cấp gian lận). balance denormalized trên RewardWallet,
// LUÔN cập nhật cùng transaction với dòng ledger mới để tránh lệch số dư.
@Injectable()
export class RewardWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async credit(
    userId: string,
    amount: number,
    type: RewardLedgerType,
    referenceId?: string,
  ): Promise<void> {
    if (amount === 0) return;
    await this.prisma.$transaction([
      this.prisma.rewardLedger.create({ data: { userId, amount, type, referenceId } }),
      this.prisma.rewardWallet.upsert({
        where: { userId },
        create: { userId, balance: amount },
        update: { balance: { increment: amount } },
      }),
    ]);
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.rewardWallet.findUnique({ where: { userId } });
    return wallet?.balance ?? 0;
  }

  async getRecentLedger(userId: string): Promise<RewardLedger[]> {
    return this.prisma.rewardLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LEDGER_LIMIT,
    });
  }
}
