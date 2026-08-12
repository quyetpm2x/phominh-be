import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { EmergencyConfirmation } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

// Thuật toán cốt lõi #6 (tai-lieu-cong-nghe-backend §7D.2 / bussiness §3, §7D.1) — đơn giản về toán
// học nhưng "quan trọng bậc nhất về hậu quả nếu sai" (bài học vụ Gas). Ngưỡng lấy từ ví dụ cụ thể
// trong tài liệu thiết kế UI gốc ("2/3 người gần đó xác nhận").
const CONFIRMATION_THRESHOLD = 3;

@Injectable()
export class EmergencyService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: "trong bán kính nhỏ" — hiện đếm mọi xác nhận không phân biệt khoảng cách người xác nhận
  // tới bài; cần thêm kiểm tra confirmer đang đứng gần bài (so bằng GPS lúc xác nhận) để đúng tinh
  // thần "xác nhận độc lập tại chỗ" thay vì xác nhận từ xa (bussiness §3).
  async confirm(
    postId: string,
    confirmerId: string,
  ): Promise<{ confirmation: EmergencyConfirmation; verified: boolean }> {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');
    if (post.postType !== 'emergency') {
      throw new BadRequestException('Chỉ bài loại khẩn cấp mới cần xác nhận đa nguồn');
    }

    const confirmation = await this.prisma.emergencyConfirmation.upsert({
      where: { postId_confirmerId: { postId, confirmerId } },
      update: {},
      create: { postId, confirmerId },
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
