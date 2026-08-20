import { Injectable, NotFoundException } from '@nestjs/common';
import type { AppSession } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

// Ghi nhận phiên mở/đóng app (bổ sung ngoài 117 mục gốc, thảo luận 2026-08-17) — trước đây bảng
// app_sessions CHỈ ĐƯỢC ĐỌC (activityFactor, G1, qualifyIfActive) nhưng KHÔNG route nào từng ghi
// vào, nên mọi nơi dựa vào bảng này luôn nhận dữ liệu rỗng. Đây là lần đầu có route ghi thật.
@Injectable()
export class AppSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async start(userId: string): Promise<{ id: string }> {
    const session = await this.prisma.appSession.create({ data: { userId } });
    return { id: session.id };
  }

  // Idempotent — gọi lại lần 2 (VD app gửi trùng lúc mạng chập chờn) không ghi đè closedAt đã có,
  // tránh 1 lần đóng muộn xoá mất thời điểm đóng thật đã ghi trước đó.
  async close(userId: string, sessionId: string): Promise<AppSession> {
    const session = await this.prisma.appSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Không tìm thấy phiên này');
    if (session.closedAt) return session;

    return this.prisma.appSession.update({
      where: { id: sessionId },
      data: { closedAt: new Date() },
    });
  }
}
