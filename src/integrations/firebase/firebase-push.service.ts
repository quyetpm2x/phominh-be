import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Gửi push thật qua Firebase Cloud Messaging — 2 mode qua PUSH_NOTIFICATION_MODE, cùng nguyên tắc
// SmsOtpService (SMS_OTP_MODE): mặc định "console" để KHÔNG cần credentials Firebase thật khi chạy
// dev hàng ngày, chỉ log ra terminal. Đổi "real" + điền FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY
// khi đã có Firebase project thật (tai-lieu-chuc-nang.md mục "Môi trường dev").
@Injectable()
export class FirebasePushService implements OnModuleInit {
  private readonly logger = new Logger(FirebasePushService.name);
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (this.config.get<string>('PUSH_NOTIFICATION_MODE', 'console') !== 'real') return;

    // Private key trong .env luôn escape \n thành chuỗi 2 ký tự "\n" (không phải xuống dòng thật) —
    // phải thay lại thành xuống dòng thật thì firebase-admin mới parse được PEM.
    const privateKey = this.config.getOrThrow<string>('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
    this.app = initializeApp({
      credential: cert({
        projectId: this.config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
        clientEmail: this.config.getOrThrow<string>('FIREBASE_CLIENT_EMAIL'),
        privateKey,
      }),
    });
  }

  async send(token: string, title: string, body: string): Promise<void> {
    const mode = this.config.get<string>('PUSH_NOTIFICATION_MODE', 'console');

    if (mode === 'console') {
      this.logger.warn(
        `[DEV — PUSH_NOTIFICATION_MODE=console] Push tới ${token}: "${title}" — ${body}`,
      );
      return;
    }

    if (mode !== 'real') {
      throw new Error(`PUSH_NOTIFICATION_MODE không hợp lệ: "${mode}" (chỉ nhận console | real)`);
    }
    if (!this.app) {
      throw new Error('FirebasePushService chưa init app — kiểm tra lại onModuleInit');
    }

    try {
      await getMessaging(this.app).send({ token, notification: { title, body } });
    } catch (error) {
      // Lỗi gửi push KHÔNG được làm hỏng luồng chính (VD tạo bình luận) — chỉ log, không throw.
      this.logger.error(`Gửi push thất bại tới ${token}: ${(error as Error).message}`);
    }
  }
}
