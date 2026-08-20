import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';

import { computeCostEstimate, type CostEstimate } from './cost-estimate.util';
import { daysAgoUtc } from './dashboard-date.util';

const WINDOW_DAYS = 30;

export interface CostEstimateReport extends CostEstimate {
  windowDays: number;
  smsCount: number;
  imageCount: number;
  activeUsers: number;
  isEstimate: true;
}

// Chi phí vận hành G8 (tai-lieu-chuc-nang.md #110, bussiness §9.7: "chi phí SMS OTP, lưu trữ ảnh R2,
// gọi Vision API — quan trọng nhất là chi phí trung bình/user hoạt động"). ƯỚC LƯỢNG từ số lượng đã
// đếm được trong DB × đơn giá cấu hình — KHÔNG gọi API hoá đơn thật của Cloudflare/nhà cung cấp SMS
// (chưa tích hợp), nên FE phải hiện rõ đây là số ước lượng, không phải số hoá đơn chính xác.
@Injectable()
export class CostEstimateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getCostEstimate(): Promise<CostEstimateReport> {
    const windowStart = daysAgoUtc(WINDOW_DAYS);

    const [smsCount, postImageCount, menuPhotoCount, activeUsers] = await Promise.all([
      // Đếm mọi bản ghi otp_verifications trong cửa sổ — bao gồm cả SĐT test (không tách riêng được
      // ở tầng truy vấn), chấp nhận sai số nhỏ vì đây vốn đã là số ƯỚC LƯỢNG.
      this.prisma.otpVerification.count({ where: { createdAt: { gte: windowStart } } }),
      // Tổng số ảnh ĐANG LƯU (không chỉ trong window) — chi phí lưu trữ tính theo dung lượng đang
      // giữ, không phải ảnh mới tải lên trong kỳ.
      this.prisma.postImage.count(),
      this.prisma.merchantMenuPhoto.count(),
      this.prisma.appSession
        .findMany({
          where: { openedAt: { gte: windowStart } },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((rows) => rows.length),
    ]);

    const estimate = computeCostEstimate({
      smsCount,
      imageCount: postImageCount + menuPhotoCount,
      activeUsers,
      smsUnitCostVnd: Number(this.config.get('SMS_UNIT_COST_VND', 300)),
      storageCostPerGbMonthVnd: Number(this.config.get('R2_STORAGE_COST_PER_GB_MONTH_VND', 375)),
      avgImageSizeMb: Number(this.config.get('AVG_IMAGE_SIZE_MB', 0.5)),
    });

    return {
      ...estimate,
      windowDays: WINDOW_DAYS,
      smsCount,
      imageCount: postImageCount + menuPhotoCount,
      activeUsers,
      isEstimate: true,
    };
  }
}
