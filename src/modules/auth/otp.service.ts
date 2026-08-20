import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';

import { normalizeVnPhoneNumber, toDomesticPhoneFormat } from '../../common/utils/phone.util';
import { SmsOtpService } from '../../integrations/sms-otp/sms-otp.service';
import { PrismaService } from '../../prisma/prisma.service';

interface OtpRow {
  id: string;
  attempts: number;
  otp_hash: string;
}

// Toàn bộ vòng đời OTP: validate/chuẩn hoá SĐT, 2 lớp rate-limit (theo SĐT + toàn hệ thống), sinh +
// hash + lưu, gọi SmsOtpService gửi thật, và verify. Xem tai-lieu-chuc-nang.md — mục
// "Nhập số điện thoại & Xác thực OTP" cho sơ đồ đầy đủ từng bước.
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly smsOtpService: SmsOtpService,
  ) {}

  async sendOtp(rawPhone: string, captchaToken?: string): Promise<{ retryAfter: number }> {
    await this.verifyCaptchaIfEnabled(captchaToken);

    const phone = normalizeVnPhoneNumber(rawPhone);
    if (!phone) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }

    const isTestPhone = this.getTestPhoneNumbers().includes(phone);
    const otp = isTestPhone ? '000000' : randomInt(100_000, 1_000_000).toString();
    const otpHash = this.hashOtp(otp);
    // Number() bắt buộc: ConfigService.get<number>() không tự ép kiểu, trả về string thô từ env.
    const resendCooldownSeconds = Number(this.config.get('OTP_RESEND_COOLDOWN_SECONDS', 60));

    // pg_advisory_xact_lock khoá riêng theo SĐT (hashtext) — request khác cùng SĐT phải đợi tới khi
    // transaction này commit, nên 2 lần đếm rate-limit bên dưới không thể bị race condition (không
    // cần Redis ở quy mô MVP, xem phân tích trong tai-lieu-chuc-nang.md).
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;
      await this.assertPerPhoneRateLimit(tx, phone, resendCooldownSeconds);
      await this.assertSystemWideRateLimit(tx);

      // Vô hiệu OTP cũ chưa dùng của cùng SĐT — chỉ 1 OTP còn hiệu lực tại 1 thời điểm.
      await tx.otpVerification.updateMany({
        where: { phoneNumber: phone, consumedAt: null },
        data: { consumedAt: new Date() },
      });

      return tx.otpVerification.create({
        data: {
          phoneNumber: phone,
          otpHash,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    });

    // SĐT test (QA/E2E/App Store review) — không gọi eSMS thật, OTP luôn cố định 000000.
    if (!isTestPhone) {
      try {
        await this.smsOtpService.sendSms(toDomesticPhoneFormat(phone), otp);
      } catch (error) {
        // Gửi thất bại là lỗi hệ thống, không phải user spam — xoá bản ghi để không tính vào
        // rate-limit/cooldown, cho phép thử lại ngay thay vì bắt chờ hết cooldown vô lý.
        await this.prisma.otpVerification.delete({ where: { id: record.id } });
        this.logger.error(`Gửi SMS OTP thất bại cho ${phone}: ${(error as Error).message}`);
        throw new ServiceUnavailableException('Gửi SMS thất bại, vui lòng thử lại');
      }
    }

    return { retryAfter: resendCooldownSeconds };
  }

  // Trả về SĐT (E.164) đã verify thành công — caller (AuthService) tự lo findOrCreate user + cấp
  // token, OtpService không biết gì về User/JWT (tách domain).
  async verifyOtp(rawPhone: string, otpInput: string): Promise<string> {
    const phone = normalizeVnPhoneNumber(rawPhone);
    if (!phone) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }

    const maxAttempts = Number(this.config.get('OTP_MAX_ATTEMPTS', 5));

    // UPDATE...RETURNING atomic — tăng attempts và đọc lại trong CÙNG 1 câu lệnh, chống race
    // condition khi có nhiều request verify song song (không đọc rồi ghi 2 bước riêng).
    // Giả định tại 1 thời điểm chỉ có tối đa 1 bản ghi chưa consumed cho 1 SĐT (đảm bảo bởi bước
    // vô hiệu hoá OTP cũ trong sendOtp), nên WHERE này luôn khớp ≤ 1 dòng.
    const rows = await this.prisma.$queryRaw<OtpRow[]>`
      UPDATE otp_verifications
      SET attempts = attempts + 1
      WHERE phone_number = ${phone} AND consumed_at IS NULL AND expires_at > now()
      RETURNING id, attempts, otp_hash
    `;
    const record = rows[0];

    // Không tìm thấy (hết hạn/đã dùng/chưa từng gửi) hoặc vượt số lần thử — cùng 1 thông báo lỗi,
    // không tiết lộ lý do cụ thể.
    if (!record || record.attempts > maxAttempts) {
      throw new UnauthorizedException('Mã xác thực không đúng hoặc đã hết hạn');
    }

    const inputHash = Buffer.from(this.hashOtp(otpInput));
    const storedHash = Buffer.from(record.otp_hash);
    if (!timingSafeEqual(inputHash, storedHash)) {
      throw new UnauthorizedException('Mã xác thực không đúng hoặc đã hết hạn');
    }

    await this.prisma.otpVerification.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    return phone;
  }

  private hashOtp(otp: string): string {
    const secret = this.config.getOrThrow<string>('OTP_HASH_SECRET');
    return createHmac('sha256', secret).update(otp).digest('hex');
  }

  private async assertPerPhoneRateLimit(
    tx: Prisma.TransactionClient,
    phone: string,
    cooldownSeconds: number,
  ): Promise<void> {
    const maxPerHour = Number(this.config.get('OTP_MAX_PER_HOUR', 5));
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const cooldownStart = new Date(Date.now() - cooldownSeconds * 1000);

    const [hourlyCount, withinCooldown] = await Promise.all([
      tx.otpVerification.count({ where: { phoneNumber: phone, createdAt: { gt: oneHourAgo } } }),
      tx.otpVerification.findFirst({
        where: { phoneNumber: phone, createdAt: { gt: cooldownStart } },
      }),
    ]);

    if (withinCooldown) {
      throw new HttpException('Vui lòng đợi trước khi gửi lại mã', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (hourlyCount >= maxPerHour) {
      throw new HttpException(
        'Đã vượt số lần gửi mã cho phép, thử lại sau',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // Không khoá theo SĐT — phát hiện tấn công PHÂN TÁN (nhiều SĐT khác nhau cùng lúc, mỗi SĐT dưới
  // ngưỡng riêng nên lớp rate-limit trên không chặn được). Ngưỡng "alert" chỉ log cảnh báo, ngưỡng
  // "block" chặn hẳn — cả 2 đều tự chọn tạm thời, cần tinh chỉnh theo traffic thật.
  private async assertSystemWideRateLimit(tx: Prisma.TransactionClient): Promise<void> {
    const alertThreshold = Number(this.config.get('OTP_SYSTEM_ALERT_THRESHOLD_5MIN', 50));
    const blockThreshold = Number(this.config.get('OTP_SYSTEM_BLOCK_THRESHOLD_5MIN', 300));
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const count = await tx.otpVerification.count({ where: { createdAt: { gt: fiveMinAgo } } });

    if (count >= blockThreshold) {
      this.logger.error(
        `Chặn OTP toàn hệ thống: ${count} OTP trong 5 phút, vượt ngưỡng ${blockThreshold}`,
      );
      throw new ServiceUnavailableException('Hệ thống đang bận, vui lòng thử lại sau');
    }
    if (count >= alertThreshold) {
      this.logger.warn(
        `Cảnh báo: ${count} OTP trong 5 phút, vượt ngưỡng cảnh báo ${alertThreshold}`,
      );
    }
  }

  private getTestPhoneNumbers(): string[] {
    const raw = this.config.get<string>('TEST_PHONE_NUMBERS', '');
    return raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => normalizeVnPhoneNumber(p))
      .filter((p): p is string => p !== null);
  }

  // Cloudflare Turnstile — tắt mặc định (CAPTCHA_ENABLED=false) vì chưa có site/secret key thật;
  // bật bằng env khi đã đăng ký Turnstile, không cần đổi code.
  private async verifyCaptchaIfEnabled(token?: string): Promise<void> {
    const enabled = this.config.get<string>('CAPTCHA_ENABLED', 'false') === 'true';
    if (!enabled) return;

    if (!token) {
      throw new BadRequestException('Thiếu captcha token');
    }
    const secret = this.config.getOrThrow<string>('CAPTCHA_SECRET_KEY');
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success: boolean };
    if (!data.success) {
      throw new BadRequestException('Captcha không hợp lệ');
    }
  }
}
