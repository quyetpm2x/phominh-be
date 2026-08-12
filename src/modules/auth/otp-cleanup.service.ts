import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';

const RETENTION_DAYS = 3;

// Dọn otp_verifications hết hạn quá vài ngày — giữ bảng gọn, không ảnh hưởng backup/restore time
// về sau. Làm ngay từ MVP (khác Redis/BullMQ — những phần cố ý hoãn tới khi có traction thật).
@Injectable()
export class OtpCleanupService {
  private readonly logger = new Logger(OtpCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredOtp(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.otpVerification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(
        `Đã dọn ${result.count} bản ghi otp_verifications cũ hơn ${RETENTION_DAYS} ngày`,
      );
    }
  }
}
