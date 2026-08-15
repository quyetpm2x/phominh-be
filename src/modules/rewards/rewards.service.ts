import { randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ReferralRedemption } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import {
  isRewardsActivated,
  REFERRAL_MONTHLY_CAP,
  REFERRAL_REWARD_AMOUNT,
} from './reward-payout.util';
import { currentPeriod } from './reward-period.util';
import { RewardWalletService } from './reward-wallet.service';

const QUALIFICATION_WINDOW_DAYS = 7; // bussiness §5.1d — chỉ trả thưởng sau khi có hoạt động thật trong 7 ngày đầu

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardWallet: RewardWalletService,
  ) {}

  async getOrCreateReferralCode(ownerUserId: string): Promise<{ code: string }> {
    const existing = await this.prisma.referralCode.findFirst({ where: { ownerUserId } });
    if (existing) return { code: existing.code };

    const code = randomBytes(4).toString('hex').toUpperCase();
    const created = await this.prisma.referralCode.create({ data: { ownerUserId, code } });
    return { code: created.code };
  }

  async redeemReferral(invitedUserId: string, code: string): Promise<ReferralRedemption> {
    const referralCode = await this.prisma.referralCode.findUnique({ where: { code } });
    if (!referralCode) throw new NotFoundException('Mã giới thiệu không hợp lệ');
    if (referralCode.ownerUserId === invitedUserId) {
      throw new BadRequestException('Không thể tự dùng mã giới thiệu của chính mình');
    }
    return this.prisma.referralRedemption.create({
      data: { referralCodeId: referralCode.id, invitedUserId },
    });
  }

  // Admin/cron gọi thủ công ở base scaffold — kiểm tra người được mời có hoạt động thật trong cửa
  // sổ 7 ngày (dùng AppSession làm tín hiệu, nhất quán với hệ số hoạt động ở TrustScoreService).
  async qualifyIfActive(redemptionId: string): Promise<boolean> {
    const redemption = await this.prisma.referralRedemption.findUniqueOrThrow({
      where: { id: redemptionId },
      include: { referralCode: true },
    });
    if (redemption.qualifiedAt) return true;

    const windowEnd = new Date(
      redemption.createdAt.getTime() + QUALIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const hasActivity = await this.prisma.appSession.findFirst({
      where: {
        userId: redemption.invitedUserId,
        openedAt: { gte: redemption.createdAt, lte: windowEnd },
      },
    });
    if (!hasActivity) return false;

    const qualifiedAt = new Date();
    await this.prisma.referralRedemption.update({
      where: { id: redemptionId },
      data: { qualifiedAt },
    });

    // Owner có thể là merchant (ownerMerchantId) — thưởng affiliate ở base scaffold này chỉ áp dụng
    // cho user thường, merchant cần luồng ví riêng (CHƯA XÂY, xem tài liệu).
    if (!redemption.referralCode.ownerUserId) return true;

    // "Cùng mốc 100 user như leaderboard — trước mốc này mã giới thiệu vẫn hoạt động nhưng KHÔNG
    // tích luỹ thưởng" (bussiness §5.1d) — không có cơ chế trả bù sau, đúng tinh thần "không hồi tố".
    const activeUserCount = await this.prisma.user.count({ where: { accountStatus: 'active' } });
    if (!isRewardsActivated(activeUserCount)) return true;

    // Trần số lượt thưởng/tháng/người mời (bussiness §5.1d) — chặn dùng nhiều SIM rác tự giới thiệu chuỗi.
    const { start, end } = currentPeriod();
    const grantedThisMonth = await this.prisma.referralRedemption.count({
      where: {
        rewardGranted: true,
        referralCode: { ownerUserId: redemption.referralCode.ownerUserId },
        qualifiedAt: { gte: start, lt: end },
      },
    });
    if (grantedThisMonth >= REFERRAL_MONTHLY_CAP) return true;

    await this.prisma.referralRedemption.update({
      where: { id: redemptionId },
      data: { rewardGranted: true },
    });
    await this.rewardWallet.credit(
      redemption.referralCode.ownerUserId,
      REFERRAL_REWARD_AMOUNT,
      'referral',
      redemptionId,
    );
    return true;
  }
}
