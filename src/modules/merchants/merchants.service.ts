import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MerchantBusinessHour, MerchantProfile, PhoneVisibility } from '@prisma/client';

import { currentVietnamDayOfWeek, currentVietnamHHmm } from '../../common/utils/vietnam-time.util';
import { PrismaService } from '../../prisma/prisma.service';

import type { RegisterMerchantDto } from './dto/register-merchant.dto';
import type { UpdatePhoneVisibilityDto } from './dto/update-phone-visibility.dto';
import { buildDailyCounts } from './merchant-stats.util';
import { isMerchantPhoneVisibleNow } from './phone-visibility.util';

export type MerchantProfileWithBusinessHours = MerchantProfile & {
  businessHours: MerchantBusinessHour[];
};

export interface MerchantPublicContact {
  phoneNumber: string;
  zaloEnabled: boolean;
}

const RECENT_POST_WINDOW_DAYS = 7;
const ADMIN_LIST_LIMIT = 50;

export interface AdminMerchantItem {
  id: string;
  businessName: string;
  category: string | null;
  addressText: string;
  isVerified: boolean;
  phoneVisibility: PhoneVisibility;
  recentPostCount: number;
  createdAt: Date;
}

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

  // Kèm businessHours (lịch theo từng thứ, mục 43) — mobile cần đọc lại lịch đã lưu để nạp sẵn vào
  // UI chỉnh sửa (quick-update.tsx), không phải chỉ dùng nội bộ để tính isMerchantPhoneVisibleNow.
  async getMine(userId: string): Promise<MerchantProfileWithBusinessHours> {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId },
      include: { businessHours: { orderBy: { dayOfWeek: 'asc' } } },
    });
    if (!merchant)
      throw new NotFoundException(
        'Chưa có hồ sơ quán — đăng ký trước qua POST /api/mobile/merchants',
      );
    return merchant;
  }

  // businessHours=undefined (không gửi field) = giữ nguyên lịch đã lưu, chỉ đổi phoneVisibility/
  // zaloEnabled — ví dụ chuyển tạm sang "Ẩn" rồi quay lại "Giờ hành chính" không phải nhập lại lịch.
  // businessHours=[] (gửi mảng rỗng) = xoá hết lịch. Có gửi mảng = THAY TOÀN BỘ (không phải patch
  // từng ngày), đơn giản hơn nhiều so với diff từng phần tử.
  async updatePhoneVisibility(
    userId: string,
    dto: UpdatePhoneVisibilityDto,
  ): Promise<MerchantProfileWithBusinessHours> {
    const merchant = await this.getMine(userId);

    if (dto.businessHours !== undefined) {
      await this.prisma.$transaction([
        this.prisma.merchantBusinessHour.deleteMany({ where: { merchantId: merchant.id } }),
        this.prisma.merchantBusinessHour.createMany({
          data: dto.businessHours.map((h) => ({
            merchantId: merchant.id,
            dayOfWeek: h.dayOfWeek,
            startTime: h.startTime,
            endTime: h.endTime,
          })),
        }),
      ]);
    }

    await this.prisma.merchantProfile.update({
      where: { userId },
      data: { phoneVisibility: dto.phoneVisibility, zaloEnabled: dto.zaloEnabled },
    });
    return this.getMine(userId);
  }

  async addMenuPhoto(userId: string, url: string, caption?: string) {
    const merchant = await this.getMine(userId);
    return this.prisma.merchantMenuPhoto.create({
      data: { merchantId: merchant.id, url, caption },
    });
  }

  // Xem/xoá ảnh Menu (tai-lieu-chuc-nang.md #42) — trước đây chỉ có route thêm, không có route xem
  // lại/xoá nên FE không thể dựng màn quản lý thật.
  async listMenuPhotos(userId: string) {
    const merchant = await this.getMine(userId);
    return this.prisma.merchantMenuPhoto.findMany({
      where: { merchantId: merchant.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async deleteMenuPhoto(userId: string, photoId: string): Promise<void> {
    const merchant = await this.getMine(userId);
    const photo = await this.prisma.merchantMenuPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.merchantId !== merchant.id) {
      throw new NotFoundException('Không tìm thấy ảnh menu này');
    }
    await this.prisma.merchantMenuPhoto.delete({ where: { id: photoId } });
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

  // SĐT/Zalo lộ cho người XEM bài merchant (tai-lieu-chuc-nang.md #43) — trước đây phoneVisibility/
  // businessHoursStart/End chỉ do merchant tự chọn và LƯU, không nơi nào ĐỌC lại để thật sự trả số
  // cho viewer, nên dù chọn "Luôn hiện" người xem cũng không thấy số ở đâu cả. Gọi từ
  // PostsService.findOne() khi post.postType === 'merchant'. Trả null nếu đang ngoài khung hiện số
  // (không phải lỗi — chỉ đơn giản là chưa tới giờ/đã chọn ẩn).
  async getPublicContact(authorId: string): Promise<MerchantPublicContact | null> {
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { userId: authorId },
      include: { user: { select: { phoneNumber: true } }, businessHours: true },
    });
    if (!merchant) return null;

    const now = new Date();
    const visible = isMerchantPhoneVisibleNow(
      merchant.phoneVisibility,
      merchant.businessHours,
      currentVietnamDayOfWeek(now),
      currentVietnamHHmm(now),
    );
    if (!visible) return null;

    return { phoneNumber: merchant.user.phoneNumber, zaloEnabled: merchant.zaloEnabled };
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

  // Danh sách merchant cho admin (tai-lieu-chuc-nang.md #97) — trước đây KHÔNG có route admin nào,
  // chỉ có route mobile tự-phục vụ. KHÔNG có hành động "duyệt/từ chối" — register() đã tự động
  // isVerified=true từ khi bỏ yêu cầu chụp mặt tiền (xem comment ở register() phía trên), nên đây
  // chỉ là màn XEM để admin giám sát, không phải hàng đợi chờ duyệt như tên mục cũ gợi ý.
  async listForAdmin(query?: string): Promise<AdminMerchantItem[]> {
    const merchants = await this.prisma.merchantProfile.findMany({
      where: query
        ? {
            OR: [
              { businessName: { contains: query, mode: 'insensitive' } },
              { addressText: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: ADMIN_LIST_LIMIT,
    });
    if (merchants.length === 0) return [];

    const sevenDaysAgo = new Date(Date.now() - RECENT_POST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const postCounts = await this.prisma.post.groupBy({
      by: ['authorId'],
      where: {
        authorId: { in: merchants.map((m) => m.userId) },
        postType: 'merchant',
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { _all: true },
    });
    const countByUser = new Map(postCounts.map((p) => [p.authorId, p._count._all]));

    return merchants.map((m) => ({
      id: m.id,
      businessName: m.businessName,
      category: m.category,
      addressText: m.addressText,
      isVerified: m.isVerified,
      phoneVisibility: m.phoneVisibility,
      recentPostCount: countByUser.get(m.userId) ?? 0,
      createdAt: m.createdAt,
    }));
  }

  private async syncGeographyColumn(merchantId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.$executeRaw`
      update merchant_profiles
      set location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      where id = ${merchantId}::uuid
    `;
  }
}
