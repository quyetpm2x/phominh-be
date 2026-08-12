import { BadRequestException, Injectable } from '@nestjs/common';
import type { FixedArea, User } from '@prisma/client';

import { generateAliasCandidate } from '../../common/utils/alias-generator';
import { PrismaService } from '../../prisma/prisma.service';
import { TrustScoreService } from '../votes/trust-score.service';

import type { SetFixedAreaDto } from './dto/set-fixed-area.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserProfileDto } from './dto/user-profile.dto';

const ALIAS_GENERATION_MAX_ATTEMPTS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trustScore: TrustScoreService,
  ) {}

  // Gọi từ AuthService ngay sau khi OtpService.verifyOtp xác nhận đúng mã — SĐT là danh tính duy
  // nhất (unique), id tự sinh (schema.prisma đã đổi, không còn gắn với Supabase Auth nữa).
  async findOrCreateByPhone(phoneNumber: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { phoneNumber } });
    if (existing) return existing;

    const alias = await this.generateUniqueAlias();
    return this.prisma.user.create({ data: { phoneNumber, alias } });
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const displayScore = await this.getDisplayTrustScore(userId);
    const tier = this.trustScore.getBadgeTier(displayScore);
    const weightTierCapped = tier < 6; // huy hiệu vẫn tăng tới 6, chỉ trọng số vote dừng ở bậc 3

    return {
      id: user.id,
      alias: user.alias,
      realName: user.realName,
      trustTier: tier,
      trustBadgeLabel: this.trustScore.getBadgeLabel(tier),
      pointsToNextTier: weightTierCapped ? this.pointsToNextTier(displayScore, tier) : null,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { realName: dto.realName } });
  }

  async setFixedArea(userId: string, dto: SetFixedAreaDto): Promise<FixedArea> {
    // TODO(mục 4.3.1 tài liệu bussiness): chỉ cho đổi khu vực tối đa 2 lần/tháng — cần bảng lịch sử
    // đổi khu vực riêng để đếm, chưa thêm ở base scaffold này.
    const area = await this.prisma.fixedArea.upsert({
      where: { userId_label: { userId, label: dto.label } },
      update: { addressText: dto.addressText, lat: dto.lat, lng: dto.lng, radiusKm: dto.radiusKm },
      create: {
        userId,
        label: dto.label,
        addressText: dto.addressText,
        lat: dto.lat,
        lng: dto.lng,
        radiusKm: dto.radiusKm,
      },
    });
    await this.syncGeographyColumn(area.id, dto.lat, dto.lng);
    return area;
  }

  async getFixedAreas(userId: string): Promise<FixedArea[]> {
    return this.prisma.fixedArea.findMany({ where: { userId } });
  }

  // "Không quan tâm" (tai-lieu-chuc-nang.md #32) — ẩn thầm lặng 1 chiều, KHÔNG thông báo cho người bị
  // ẩn (khác block 2 chiều). upsert nên gọi lại nhiều lần không lỗi (idempotent).
  async ignoreUser(userId: string, ignoredUserId: string): Promise<void> {
    if (userId === ignoredUserId) {
      throw new BadRequestException('Không thể tự ẩn chính mình');
    }
    await this.prisma.ignoredUser.upsert({
      where: { userId_ignoredUserId: { userId, ignoredUserId } },
      update: {},
      create: { userId, ignoredUserId },
    });
  }

  async unignoreUser(userId: string, ignoredUserId: string): Promise<void> {
    await this.prisma.ignoredUser.deleteMany({ where: { userId, ignoredUserId } });
  }

  // Tầng 4 #38 "Danh sách đã ẩn (quản lý Không quan tâm)".
  async listIgnoredUsers(userId: string): Promise<Array<{ id: string; alias: string }>> {
    const rows = await this.prisma.ignoredUser.findMany({
      where: { userId },
      include: { ignoredUser: { select: { id: true, alias: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.ignoredUser);
  }

  // Dùng để lọc feed (PostsService.findNearby) — bài của người đã bị ẩn không hiện với người xem.
  async getIgnoredUserIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.ignoredUser.findMany({
      where: { userId },
      select: { ignoredUserId: true },
    });
    return rows.map((r) => r.ignoredUserId);
  }

  // E1 (cache, chỉ tăng) trừ tổng E2_hiệu_lực của các vi phạm CHƯA bị khiếu nại-thắng, tính lại mỗi
  // lần đọc thay vì lưu sẵn — vì E2_hiệu_lực tự phai theo ngày kể cả không có sự kiện mới nào xảy ra.
  async getDisplayTrustScore(userId: string): Promise<number> {
    const scores = await this.getDisplayTrustScoresForUsers([userId]);
    return scores.get(userId) ?? 0;
  }

  // Dùng cho huy hiệu uy tín hiện cạnh tên mỗi bài đăng/bình luận (Tầng 2 task 17) — batch 1 lần
  // cho nhiều tác giả cùng lúc thay vì N truy vấn riêng lẻ (findNearby có thể trả tới 200 bài).
  async getBadgeLabelsForUsers(userIds: string[]): Promise<Map<string, string>> {
    const scores = await this.getDisplayTrustScoresForUsers(userIds);
    const labels = new Map<string, string>();
    for (const [userId, score] of scores) {
      labels.set(userId, this.trustScore.getBadgeLabel(this.trustScore.getBadgeTier(score)));
    }
    return labels;
  }

  private async getDisplayTrustScoresForUsers(userIds: string[]): Promise<Map<string, number>> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return new Map();

    const [users, violations, reversals] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, trustScoreE1: true },
      }),
      this.prisma.trustScoreHistory.findMany({
        where: { userId: { in: uniqueIds }, sourceType: 'violation_confirmed' },
      }),
      this.prisma.trustScoreHistory.findMany({
        where: { userId: { in: uniqueIds }, sourceType: 'appeal_reversal' },
        select: { referenceId: true },
      }),
    ]);
    const reversedIds = new Set(reversals.map((r) => r.referenceId));
    const now = new Date();
    const effectiveE2ByUser = new Map<string, number>();
    for (const v of violations) {
      if (reversedIds.has(v.id)) continue;
      const penalty = this.trustScore.getEffectivePenalty(Math.abs(v.delta), v.createdAt, now);
      effectiveE2ByUser.set(v.userId, (effectiveE2ByUser.get(v.userId) ?? 0) + penalty);
    }

    const scores = new Map<string, number>();
    for (const user of users) {
      scores.set(user.id, user.trustScoreE1 - (effectiveE2ByUser.get(user.id) ?? 0));
    }
    return scores;
  }

  private pointsToNextTier(displayScore: number, _tier: number): number | null {
    const thresholds = [100, 1_000, 10_000, 50_000, 200_000, 500_000];
    const next = thresholds.find((t) => t > displayScore);
    return next ? Math.ceil(next - displayScore) : null;
  }

  private async generateUniqueAlias(): Promise<string> {
    for (let attempt = 0; attempt < ALIAS_GENERATION_MAX_ATTEMPTS; attempt++) {
      const candidate = generateAliasCandidate();
      const taken = await this.prisma.user.findUnique({ where: { alias: candidate } });
      if (!taken) return candidate;
    }
    throw new Error(
      'Không sinh được bí danh chưa trùng sau nhiều lần thử — kiểm tra lại không gian sinh chuỗi',
    );
  }

  // Cột geography là Unsupported() với Prisma Client nên phải ghi bằng raw SQL riêng sau khi upsert
  // xong phần còn lại của FixedArea qua Prisma bình thường.
  private async syncGeographyColumn(areaId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.$executeRaw`
      update fixed_areas
      set location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      where id = ${areaId}::uuid
    `;
  }
}
