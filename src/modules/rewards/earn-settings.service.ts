import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { UpdateEarnSettingsDto } from './dto/earn-settings.dto';

export interface EarnSettings {
  earnViaPostsEnabled: boolean;
  affiliateEnabled: boolean;
  earnEnabledAt: Date | null;
}

// 2 công tắc opt-in kiếm tiền (bussiness §5.1a) — E1/E2 vẫn tính cho MỌI user bất kể 2 cờ này, chỉ
// riêng việc QUY ĐỔI thành tiền thật (leaderboard/affiliate) mới cần bật.
@Injectable()
export class EarnSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string): Promise<EarnSettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { earnViaPostsEnabled: true, affiliateEnabled: true, earnEnabledAt: true },
    });
    return user;
  }

  // "Không hồi tố": earnEnabledAt chỉ nhận MỐC MỚI khi chuyển từ "cả 2 công tắc tắt" sang "có ít
  // nhất 1 công tắc bật" — tắt lại rồi bật lại tính mốc mới, không khôi phục mốc cũ (bussiness §5.1a).
  async updateSettings(userId: string, dto: UpdateEarnSettingsDto): Promise<EarnSettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { earnViaPostsEnabled: true, affiliateEnabled: true },
    });
    const nextEarnViaPosts = dto.earnViaPostsEnabled ?? user.earnViaPostsEnabled;
    const nextAffiliate = dto.affiliateEnabled ?? user.affiliateEnabled;

    const wasBothOff = !user.earnViaPostsEnabled && !user.affiliateEnabled;
    const willHaveAnyOn = nextEarnViaPosts || nextAffiliate;
    const earnEnabledAt = willHaveAnyOn ? (wasBothOff ? new Date() : undefined) : null;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        earnViaPostsEnabled: nextEarnViaPosts,
        affiliateEnabled: nextAffiliate,
        ...(earnEnabledAt !== undefined && { earnEnabledAt }),
      },
      select: { earnViaPostsEnabled: true, affiliateEnabled: true, earnEnabledAt: true },
    });
  }
}
