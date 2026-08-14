import { Injectable } from '@nestjs/common';
import type { Notification, NotificationDigestSetting, PushToken } from '@prisma/client';

import { FirebasePushService } from '../../integrations/firebase/firebase-push.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { RegisterPushTokenDto } from './dto/register-push-token.dto';
import type { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

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
  // để liệt kê lại được, kèm gửi push best-effort (lỗi push không được làm hỏng luồng gọi hàm này,
  // xem FirebasePushService.send — tự nuốt lỗi, không throw).
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

    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    await Promise.all(tokens.map((t) => this.firebasePush.send(t.token, title, body)));

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
