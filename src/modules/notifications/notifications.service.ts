import { Injectable, NotImplementedException } from '@nestjs/common';
import type { NotificationDigestSetting, PushToken } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { RegisterPushTokenDto } from './dto/register-push-token.dto';
import type { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  // Gửi thật qua Firebase Cloud Messaging — chưa nối (bussiness §7). Khi bật BullMQ (jobs/README.md),
  // "gửi digest thông báo" chạy như 1 job cron gọi hàm này theo batch, không gọi đồng bộ trong request.
  sendPush(_userId: string, _title: string, _body: string): Promise<void> {
    throw new NotImplementedException(
      'NotificationsService.sendPush chưa nối Firebase Cloud Messaging thật',
    );
  }
}
