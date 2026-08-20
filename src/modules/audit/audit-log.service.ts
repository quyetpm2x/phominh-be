import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

const LOG_LIMIT = 100;

export interface AuditLogItem {
  id: string;
  adminName: string;
  adminEmail: string;
  dataType: string;
  targetId: string;
  reason: string | null;
  createdAt: Date;
}

// Xem log truy cập dữ liệu nhạy cảm (tai-lieu-chuc-nang.md #105) — SensitiveDataAccessLog đã được
// ghi thật từ nhiều nơi (reveal-private-comment #88, reveal user detail #92), nhưng trước đây KHÔNG
// có endpoint nào đọc lại danh sách này cho admin xem/lọc — quyền view_sensitive_access_log đã seed
// sẵn từ trước (scripts/create-owner.ts) nhưng chưa route nào dùng tới.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dataType?: string): Promise<AuditLogItem[]> {
    const logs = await this.prisma.sensitiveDataAccessLog.findMany({
      where: dataType ? { dataType } : undefined,
      orderBy: { createdAt: 'desc' },
      take: LOG_LIMIT,
      include: { adminUser: { select: { name: true, email: true } } },
    });
    return logs.map((l) => ({
      id: l.id,
      adminName: l.adminUser.name,
      adminEmail: l.adminUser.email,
      dataType: l.dataType,
      targetId: l.targetId,
      reason: l.reason,
      createdAt: l.createdAt,
    }));
  }
}
