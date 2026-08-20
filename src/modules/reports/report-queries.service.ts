import { Injectable } from '@nestjs/common';
import type { Report, ReportStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

// 3 hàng đợi RIÊNG BIỆT cho admin (tai-lieu-chuc-nang.md #86-88, ported từ B1/B2/B3 trong
// Admin.dc.html) — tách khỏi ReportsService (tạo report/cập nhật trạng thái) để giữ file dưới
// 250 dòng và vì đây thuần là truy vấn đọc, không chạm logic phạt điểm.
@Injectable()
export class ReportQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPostReports(status?: ReportStatus): Promise<Report[]> {
    return this.prisma.report.findMany({
      where: { targetType: 'post', status },
      orderBy: { createdAt: 'asc' },
      include: {
        post: {
          select: {
            id: true,
            content: true,
            status: true,
            createdAt: true,
            author: { select: { alias: true } },
            images: { select: { url: true, exifCapturedAt: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  async findPublicCommentReports(status?: ReportStatus): Promise<Report[]> {
    return this.prisma.report.findMany({
      where: { targetType: 'comment', status, comment: { visibility: 'public' } },
      orderBy: { createdAt: 'asc' },
      include: {
        comment: {
          select: {
            id: true,
            content: true,
            isHidden: true,
            createdAt: true,
            author: { select: { alias: true } },
          },
        },
      },
    });
  }

  // Report "nghi ngờ bán chuyên nghiệp trá hình" (tai-lieu-chuc-nang.md #98, ScreenId D2) — trước
  // đây user tạo được (mục 31, targetType='merchant_suspicious') nhưng KHÔNG route admin nào đọc
  // lại. Xử lý (actioned/dismissed) dùng CHUNG ReportsService.updateStatus() — hàm đó đã hỗ trợ sẵn
  // report.merchantId từ trước (resolveViolatorId), không cần sửa gì thêm ở đó.
  async findMerchantSuspiciousReports(status?: ReportStatus): Promise<Report[]> {
    return this.prisma.report.findMany({
      where: { targetType: 'merchant_suspicious', status },
      orderBy: { createdAt: 'asc' },
      include: {
        merchant: { select: { id: true, businessName: true, addressText: true } },
      },
    });
  }

  // Nội dung KHÔNG include ở đây — bắt buộc gọi ReportsService.revealPrivateComment() (ghi log lý
  // do) trước mới xem được (bussiness §9.9, tai-lieu-chuc-nang.md #88).
  async findPrivateCommentReports(status?: ReportStatus): Promise<Report[]> {
    return this.prisma.report.findMany({
      where: { targetType: 'comment', status, comment: { visibility: 'private' } },
      orderBy: { createdAt: 'asc' },
      include: {
        comment: {
          select: {
            id: true,
            isHidden: true,
            createdAt: true,
            author: { select: { alias: true } },
          },
        },
      },
    });
  }
}
