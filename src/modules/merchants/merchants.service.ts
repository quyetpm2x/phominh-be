import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { MerchantProfile } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { RegisterMerchantDto } from './dto/register-merchant.dto';
import type { UpdatePhoneVisibilityDto } from './dto/update-phone-visibility.dto';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async register(userId: string, dto: RegisterMerchantDto): Promise<MerchantProfile> {
    const existing = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Tài khoản này đã có hồ sơ quán');

    // TODO(bussiness §2.1): điều kiện xác minh đầy đủ (GPS khớp thực tế + 1 lần chụp trực tiếp mặt
    // tiền quán + OTP) chưa implement — isVerified mặc định false, admin duyệt thủ công qua D1.
    const merchant = await this.prisma.merchantProfile.create({
      data: {
        userId,
        businessName: dto.businessName,
        addressText: dto.addressText,
        lat: dto.lat,
        lng: dto.lng,
        category: dto.category,
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

  private async syncGeographyColumn(merchantId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.$executeRaw`
      update merchant_profiles
      set location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      where id = ${merchantId}::uuid
    `;
  }
}
