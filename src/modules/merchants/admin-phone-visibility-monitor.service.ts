import { Injectable } from '@nestjs/common';
import type { PhoneVisibility } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface PhoneVisibilityMonitorItem {
  id: string;
  businessName: string;
  phoneVisibility: PhoneVisibility;
  // Lịch theo từng thứ (mục 43, thay 2 field phẳng businessHoursStart/End cũ) — rỗng nếu chưa cấu
  // hình ngày nào, kể cả khi phoneVisibility='business_hours' (nghĩa là đang ẩn cả tuần trên thực tế).
  businessHours: { dayOfWeek: number; startTime: string; endTime: string }[];
  // Chỉ có giá trị khi phoneVisibility='always' — số ngày kể từ lần sửa hồ sơ gần nhất, PHÉP GẦN
  // ĐÚNG cho "đã bật Luôn hiện bao lâu" (bussiness §9.4 D3: "phát hiện lạm dụng bật số liên tục
  // 24/7") vì `updatedAt` là mốc sửa CHUNG cả hồ sơ, không tách riêng lịch sử đổi phoneVisibility —
  // không có bảng lịch sử đổi chế độ nào tồn tại, và hầu như chỉ có updatePhoneVisibility() ghi vào
  // model này ngoài lúc tạo, nên đây là ước lượng chấp nhận được, không phải số chính xác tuyệt đối.
  alwaysVisibleForDays: number | null;
}

// Giám sát ẩn/hiện SĐT theo giờ (tai-lieu-chuc-nang.md #99, ScreenId D3) — trước đây route CHỈ có
// cho merchant tự đổi (updatePhoneVisibility), không route admin nào đọc lại để giám sát.
@Injectable()
export class AdminPhoneVisibilityMonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PhoneVisibilityMonitorItem[]> {
    const merchants = await this.prisma.merchantProfile.findMany({
      // PhoneVisibility khai báo theo thứ tự always/business_hours/hidden trong schema.prisma —
      // Postgres ENUM sắp xếp theo đúng thứ tự khai báo đó (không phải bảng chữ cái), nên asc ở
      // đây cho "always" lên đầu, đúng ý giám sát ưu tiên xem trước (bussiness §9.4 D3).
      orderBy: [{ phoneVisibility: 'asc' }, { updatedAt: 'asc' }],
      select: {
        id: true,
        businessName: true,
        phoneVisibility: true,
        updatedAt: true,
        businessHours: {
          select: { dayOfWeek: true, startTime: true, endTime: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    const now = Date.now();
    return merchants.map((m) => ({
      id: m.id,
      businessName: m.businessName,
      phoneVisibility: m.phoneVisibility,
      businessHours: m.businessHours,
      alwaysVisibleForDays:
        m.phoneVisibility === 'always'
          ? Math.floor((now - m.updatedAt.getTime()) / (1000 * 60 * 60 * 24))
          : null,
    }));
  }
}
