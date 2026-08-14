import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';

const GRACE_DAYS = 30;

// Xoá tài khoản mềm 30 ngày (tai-lieu-chuc-nang.md #69/#73) — chạy hàng ngày, hard-delete user nào
// đã quá hạn ân hạn mà chưa đăng nhập lại để khôi phục (AccountLifecycleService.restoreIfPendingDeletion).
// onDelete: Cascade trên mọi quan hệ của User tự dọn hết bài/bình luận/vote... liên quan.
@Injectable()
export class AccountDeletionCronService {
  private readonly logger = new Logger(AccountDeletionCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async hardDeleteExpiredAccounts(): Promise<void> {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
    const expired = await this.prisma.user.findMany({
      where: { deletionRequestedAt: { lt: cutoff } },
      select: { id: true },
    });
    if (expired.length === 0) return;

    for (const { id } of expired) {
      await this.prisma.dataDeletionRequest.updateMany({
        where: { userId: id, status: 'requested' },
        data: { status: 'completed', completedAt: new Date() },
      });
      await this.prisma.user.delete({ where: { id } });
    }
    this.logger.log(`Đã hard-delete ${expired.length} tài khoản quá hạn ${GRACE_DAYS} ngày ân hạn`);
  }
}
