import { Injectable } from '@nestjs/common';
import type { Notification, NotificationDigestSetting, PushToken } from '@prisma/client';

import { currentVietnamHHmm } from '../../common/utils/vietnam-time.util';
import { FirebasePushService } from '../../integrations/firebase/firebase-push.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { RegisterPushTokenDto } from './dto/register-push-token.dto';
import type { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { isWithinQuietHours } from './quiet-hours.util';

const NOTIFICATION_PAGE_SIZE = 50;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebasePush: FirebasePushService,
  ) {}

  async registerPushToken(userId: string, dto: RegisterPushTokenDto): Promise<PushToken> {
    return this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform },
      create: { userId, token: dto.token, platform: dto.platform },
    });
  }

  async getDigestSettings(userId: string): Promise<NotificationDigestSetting> {
    const existing = await this.prisma.notificationDigestSetting.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.notificationDigestSetting.create({ data: { userId } }); // default weekly
  }

  async updateDigestSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationDigestSetting> {
    return this.prisma.notificationDigestSetting.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  // Trung tâm thông báo trong app (tai-lieu-chuc-nang.md #47, #49) — LUÔN ghi vào bảng notifications
  // để liệt kê lại được (không bao giờ mất tin), kèm gửi push best-effort — TRỪ khi đang trong "Giờ
  // yên tĩnh" của user (mục 48: trước đây quietHoursStart/End chỉ lưu, không nơi nào đọc lại để thật
  // sự hoãn push, nên máy vẫn kêu/rung giữa đêm bất kể user đã đặt giờ nào). Lỗi push không được làm
  // hỏng luồng gọi hàm này, xem FirebasePushService.send — tự nuốt lỗi, không throw.
  async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    referenceId?: string,
  ): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, referenceId },
    });

    const settings = await this.getDigestSettings(userId);
    const inQuietHours = isWithinQuietHours(
      currentVietnamHHmm(),
      settings.quietHoursStart,
      settings.quietHoursEnd,
    );
    if (!inQuietHours) {
      const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
      await Promise.all(tokens.map((t) => this.firebasePush.send(t.token, title, body)));
    }

    return notification;
  }

  async listNotifications(userId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATION_PAGE_SIZE,
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
