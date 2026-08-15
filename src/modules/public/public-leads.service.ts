import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MarketingLead } from '@prisma/client';

import { normalizeVnPhoneNumber } from '../../common/utils/phone.util';
import { PrismaService } from '../../prisma/prisma.service';

import type { ContactMessageDto } from './dto/contact-message.dto';
import type { PilotSignupDto } from './dto/pilot-signup.dto';
import type { RegisterMerchantLeadDto } from './dto/register-merchant-lead.dto';

// Lưu lead từ web marketing vào bảng chung marketing_leads (payload Json, xem schema.prisma) — chỉ
// LƯU, chưa có xử lý/thông báo tự động gì thêm (đội vận hành tự tra bảng, ngoài phạm vi đợt này).
@Injectable()
export class PublicLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async registerMerchantLead(dto: RegisterMerchantLeadDto): Promise<void> {
    const phoneNumber = normalizeVnPhoneNumber(dto.phoneNumber);
    if (!phoneNumber) throw new BadRequestException('Số điện thoại không hợp lệ');

    await this.prisma.marketingLead.create({
      data: {
        type: 'merchant_signup',
        payload: { businessName: dto.businessName, phoneNumber, address: dto.address },
      },
    });
  }

  async registerPilotSignup(dto: PilotSignupDto): Promise<void> {
    const phoneNumber = normalizeVnPhoneNumber(dto.phoneNumber);
    if (!phoneNumber) throw new BadRequestException('Số điện thoại không hợp lệ');

    await this.prisma.marketingLead.create({
      data: { type: 'pilot_area_signup', payload: { phoneNumber } },
    });
  }

  async submitContact(dto: ContactMessageDto): Promise<void> {
    await this.prisma.marketingLead.create({
      data: {
        type: 'contact',
        payload: { name: dto.name, contact: dto.contact, message: dto.message },
      },
    });
  }

  // Đọc lại cho admin panel (tai-lieu-chuc-nang.md #75-83) — type/handled đều optional, không
  // truyền gì thì trả tất cả, mới nhất trước.
  async listLeads(type?: string, handled?: boolean): Promise<MarketingLead[]> {
    let handledAtFilter: { not: null } | null | undefined;
    if (handled === true) handledAtFilter = { not: null };
    else if (handled === false) handledAtFilter = null;

    return this.prisma.marketingLead.findMany({
      where: { type, handledAt: handledAtFilter },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setHandled(id: string, handled: boolean): Promise<MarketingLead> {
    const lead = await this.prisma.marketingLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Không tìm thấy lead');

    return this.prisma.marketingLead.update({
      where: { id },
      data: { handledAt: handled ? new Date() : null },
    });
  }
}
