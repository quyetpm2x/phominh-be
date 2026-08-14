import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MerchantProfile } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { RegisterMerchantDto } from './dto/register-merchant.dto';
import type { UpdatePhoneVisibilityDto } from './dto/update-phone-visibility.dto';
import { buildDailyCounts } from './merchant-stats.util';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  // ĐÃ BỎ yêu cầu chụp mặt tiền quán (bussiness §2.1 bản gốc) — quyết định đơn giản hoá mới nhất:
  // bỏ hẳn bước này, không cần Vision API xác minh ảnh. Điều kiện xác minh giờ chỉ còn: SĐT đã xác
  // thực OTP (bắt buộc để đăng nhập, đã có sẵn từ trước khi vào tới đây) + toạ độ GPS lúc đăng ký —
  // đủ để auto-verify ngay, không cần admin duyệt tay qua D1 nữa.
  async register(userId: string, dto: RegisterMerchantDto): Promise<MerchantProfile> {
    const existing = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Tài khoản này đã có hồ sơ quán');

    const merchant = await this.prisma.merchantProfile.create({
      data: {
        userId,
        businessName: dto.businessName,
        addressText: dto.addressText,
        lat: dto.lat,
        lng: dto.lng,
        category: dto.category,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    await this.syncGeographyColumn(merchant.id, dto.lat, dto.lng);
    return merchant;
  }

  async getMine(userId: string): Promise<MerchantProfile> {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant)
      throw new NotFoundException(
        'Chưa có hồ sơ quán — đăng ký trước qua POST /api/mobile/merchants',
      );
    return merchant;
  }

  async updatePhoneVisibility(
    userId: string,
    dto: UpdatePhoneVisibilityDto,
  ): Promise<MerchantProfile> {
    await this.getMine(userId);
    return this.prisma.merchantProfile.update({
      where: { userId },
      data: {
        phoneVisibility: dto.phoneVisibility,
        businessHoursStart: dto.businessHoursStart,
        businessHoursEnd: dto.businessHoursEnd,
        zaloEnabled: dto.zaloEnabled,
      },
    });
  }

  async addMenuPhoto(userId: string, url: string, caption?: string) {
    const merchant = await this.getMine(userId);
    return this.prisma.merchantMenuPhoto.create({
      data: { merchantId: merchant.id, url, caption },
    });
  }

  // Dashboard quán (tai-lieu-chuc-nang.md #40) — bài merchant đang hoạt động (tối đa 1, vì mỗi bài
  // merchant tự ẩn sau 24h — bussiness mục 3) kèm đếm ngược tới expiresAt, không tự tính ở đây (FE
  // tự đếm lùi từ expiresAt để không phải poll liên tục).
  async getDashboard(userId: string) {
    const merchant = await this.getMine(userId);
    const activePost = await this.prisma.post.findFirst({
      where: { authorId: userId, postType: 'merchant', status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    const viewCount = activePost
      ? await this.prisma.postView.count({ where: { postId: activePost.id } })
      : 0;

    return {
      merchant,
      activePost: activePost
        ? {
            id: activePost.id,
            content: activePost.content,
            imageUrl: activePost.images[0]?.url ?? null,
            createdAt: activePost.createdAt,
            expiresAt: activePost.expiresAt,
            voteCount: activePost.voteCount,
            commentCount: activePost.commentCount,
            viewCount,
          }
        : null,
    };
  }

  // Thống kê lượt xem 7 ngày gần nhất (tai-lieu-chuc-nang.md #44), gộp mọi bài merchant của quán —
  // CHỈ số liệu tổng hợp theo ngày, không có breakdown theo vị trí người xem (giữ tối giản, tránh
  // thu thập thêm vị trí gắn với từng lượt xem ngoài phạm vi đã chốt).
  async getStats(userId: string): Promise<{ totalViews: number; dailyCounts: number[] }> {
    const merchant = await this.getMine(userId);
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      select date_trunc('day', pv.viewed_at) as day, count(*) as count
      from post_views pv
      join posts p on p.id = pv.post_id
      where p.author_id = ${merchant.userId}::uuid and p.post_type = 'merchant'
        and pv.viewed_at > now() - interval '7 days'
      group by day
      order by day
    `;
    const countByDay = new Map(
      rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]),
    );
    const dailyCounts = buildDailyCounts(countByDay, new Date());
    return { totalViews: dailyCounts.reduce((sum, v) => sum + v, 0), dailyCounts };
  }

  // Chặn merchant khai gian isLibraryPhoto (tai-lieu-chuc-nang.md #7c) — chỉ merchant ĐÃ isVerified
  // mới được dùng ảnh thư viện thay vì bắt buộc chụp trực tiếp. Từ khi register() tự động
  // isVerified=true (đã bỏ chụp mặt tiền), check này chủ yếu chặn user KHÔNG PHẢI merchant tự ý gửi
  // isLibraryPhoto=true — vẫn cần giữ vì CreatePostDto nhận field này từ mọi loại tài khoản.
  async assertVerifiedForLibraryPhoto(userId: string): Promise<void> {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant?.isVerified) {
      throw new ForbiddenException(
        'Chỉ tài khoản quán đã xác minh mới được dùng ảnh từ thư viện (bussiness §2.1)',
      );
    }
  }

  private async syncGeographyColumn(merchantId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.$executeRaw`
      update merchant_profiles
      set location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      where id = ${merchantId}::uuid
    `;
  }
}
