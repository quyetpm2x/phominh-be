import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { EmergencyConfirmation } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';

import type { ConfirmEmergencyDto } from './dto/confirm-emergency.dto';
import { distanceMeters } from './emergency-distance.util';

// Thuật toán cốt lõi #6 (tai-lieu-cong-nghe-backend §7D.2 / bussiness §3, §7D.1) — đơn giản về toán
// học nhưng "quan trọng bậc nhất về hậu quả nếu sai" (bài học vụ Gas). Ngưỡng lấy từ ví dụ cụ thể
// trong tài liệu thiết kế UI gốc ("2/3 người gần đó xác nhận").
const CONFIRMATION_THRESHOLD = 3;

// "Trong bán kính nhỏ" (bussiness §3) — nhỏ hơn bán kính feed mặc định (2km), nhưng đủ rộng để dung
// sai GPS + người xác nhận không đứng chính xác tại điểm xảy ra sự việc.
const CONFIRMATION_RADIUS_METERS = 1_000;

@Injectable()
export class EmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
  ) {}

  // "Trong bán kính nhỏ" (tai-lieu-chuc-nang.md #7e, bussiness §3) — so GPS lúc xác nhận với vị trí
  // bài, đúng tinh thần "xác nhận độc lập tại chỗ" thay vì xác nhận từ xa. GPS giả bị chặn ngay từ
  // ModerationService (cùng cơ chế PostsService.create dùng cho đăng bài).
  async confirm(
    postId: string,
    confirmerId: string,
    dto: ConfirmEmergencyDto,
  ): Promise<{ confirmation: EmergencyConfirmation; verified: boolean }> {
    this.moderationService.checkMockGps(dto.isMockLocation ?? false);

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');
    if (post.postType !== 'emergency') {
      throw new BadRequestException('Chỉ bài loại khẩn cấp mới cần xác nhận đa nguồn');
    }

    const distance = distanceMeters(
      { lat: post.lat, lng: post.lng },
      { lat: dto.lat, lng: dto.lng },
    );
    if (distance > CONFIRMATION_RADIUS_METERS) {
      throw new BadRequestException(
        `Bạn đang cách bài đăng ${Math.round(distance / 100) / 10}km — chỉ xác nhận được khi ở gần (trong bán kính ${CONFIRMATION_RADIUS_METERS}m)`,
      );
    }

    const confirmation = await this.prisma.emergencyConfirmation.upsert({
      where: { postId_confirmerId: { postId, confirmerId } },
      update: { lat: dto.lat, lng: dto.lng },
      create: { postId, confirmerId, lat: dto.lat, lng: dto.lng },
    });

    const confirmCount = await this.prisma.emergencyConfirmation.count({ where: { postId } });
    const verified = confirmCount >= CONFIRMATION_THRESHOLD;
    if (verified && !post.emergencyVerifiedAt) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { emergencyVerifiedAt: new Date() },
      });
    }

    return { confirmation, verified };
  }

  async getStatus(postId: string) {
    const [post, confirmCount] = await Promise.all([
      this.prisma.post.findUniqueOrThrow({ where: { id: postId } }),
      this.prisma.emergencyConfirmation.count({ where: { postId } }),
    ]);
    return {
      confirmCount,
      threshold: CONFIRMATION_THRESHOLD,
      isWidelyVisible: confirmCount >= CONFIRMATION_THRESHOLD,
      verifiedAt: post.emergencyVerifiedAt,
    };
  }
}
