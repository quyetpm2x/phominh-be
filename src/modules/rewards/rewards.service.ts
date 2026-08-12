import { randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

const QUALIFICATION_WINDOW_DAYS = 7; // bussiness §5.1 — chỉ trả thưởng sau khi có hoạt động thật trong 7 ngày đầu
const LEADERBOARD_LIMIT = 20;
// TODO(sản phẩm cần chốt): mệnh giá voucher/điểm thưởng referral cụ thể — tài liệu chỉ nói "thưởng
// dùng chung ví điểm quy đổi voucher tiểu thương", chưa chốt con số.
const REFERRAL_REWARD_POINTS = 0;

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  // Xếp hạng theo E1 cache (raw), CHƯA trừ E2_hiệu_lực và CHƯA giới hạn theo tháng (bussiness §5.1
  // "reset theo tháng, không cố định vĩnh viễn") — cần 1 bảng snapshot theo kỳ để làm đúng, để lại
  // TODO khi có traction thật; tránh N+1 query tính effective score cho từng dòng ở base scaffold.
  async getLeaderboard(): Promise<{ id: string; alias: string; trustScoreE1: number }[]> {
    return this.prisma.user.findMany({
      where: { isBanned: false },
      orderBy: { trustScoreE1: 'desc' },
      take: LEADERBOARD_LIMIT,
      select: { id: true, alias: true, trustScoreE1: true },
    });
  }

  async getOrCreateReferralCode(ownerUserId: string): Promise<{ code: string }> {
    const existing = await this.prisma.referralCode.findFirst({ where: { ownerUserId } });
    if (existing) return { code: existing.code };

    const code = randomBytes(4).toString('hex').toUpperCase();
    const created = await this.prisma.referralCode.create({ data: { ownerUserId, code } });
    return { code: created.code };
  }

  async redeemReferral(invitedUserId: string, code: string) {
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

    await this.prisma.$transaction([
      this.prisma.referralRedemption.update({
        where: { id: redemptionId },
        data: { qualifiedAt: new Date(), rewardGranted: true },
      }),
      this.prisma.rewardLedger.create({
        data: {
          userId: redemption.invitedUserId,
          amount: REFERRAL_REWARD_POINTS,
          type: 'referral',
          referenceId: redemptionId,
        },
      }),
    ]);
    return true;
  }
}
