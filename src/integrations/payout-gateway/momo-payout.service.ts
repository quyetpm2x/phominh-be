import { randomUUID } from 'node:crypto';

import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { verifyHmacSignature } from '../../common/utils/webhook-signature.util';

import type { IPayoutGateway, PayoutResult } from './payout-gateway.interface';

// Chi hộ qua Momo Business — 2 mode qua PAYOUT_GATEWAY_MODE, cùng nguyên tắc SmsOtpService/
// FirebasePushService: mặc định "console" (giả lập, KHÔNG cần credentials thật) để luồng rút tiền
// chạy được và test được ngay trong dev. Đổi "real" khi đã có hợp đồng đối tác Momo Business thật —
// LƯU Ý QUAN TRỌNG: nhánh "real" bên dưới CHƯA gọi API thật, vì chưa có tài liệu API chính thức từ
// Momo (endpoint chi hộ, format request/response, thuật toán ký chữ ký) — cố tình ném
// NotImplementedException thay vì đoán bừa format, tránh implement sai rồi chuyển tiền thật nhầm.
@Injectable()
export class MomoPayoutService implements IPayoutGateway {
  private readonly logger = new Logger(MomoPayoutService.name);

  constructor(private readonly config: ConfigService) {}

  async transfer(amountVnd: number, bankAccountId: string): Promise<PayoutResult> {
    const mode = this.config.get<string>('PAYOUT_GATEWAY_MODE', 'console');

    if (mode === 'console') {
      const providerTransactionId = `MOCK-${randomUUID()}`;
      this.logger.warn(
        `[DEV — PAYOUT_GATEWAY_MODE=console] Giả lập chi hộ ${amountVnd}đ → bankAccountId=${bankAccountId}, providerTransactionId=${providerTransactionId}`,
      );
      return { providerTransactionId, status: 'success' };
    }

    if (mode !== 'real') {
      throw new Error(`PAYOUT_GATEWAY_MODE không hợp lệ: "${mode}" (chỉ nhận console | real)`);
    }

    // Đọc trước credentials để fail-fast nếu thiếu cấu hình, dù chưa dùng để gọi API thật.
    this.config.getOrThrow<string>('MOMO_PARTNER_CODE');
    this.config.getOrThrow<string>('MOMO_ACCESS_KEY');
    this.config.getOrThrow<string>('MOMO_SECRET_KEY');
    throw new NotImplementedException(
      'MomoPayoutService.transfer (real mode) chưa nối API chi hộ Momo thật — cần tài liệu API ' +
        'chính thức từ Momo Business (endpoint, request/response, thuật toán ký) trước khi implement.',
    );
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const mode = this.config.get<string>('PAYOUT_GATEWAY_MODE', 'console');

    if (mode === 'console') {
      // Dev-only shared secret — CHỈ để tự test luồng webhook cục bộ (VD curl giả lập callback),
      // KHÔNG liên quan gì tới thuật toán ký thật của Momo.
      const devSecret = this.config.get<string>('PAYOUT_WEBHOOK_DEV_SECRET', 'dev-only-secret');
      return verifyHmacSignature(rawBody, signature, devSecret);
    }

    if (mode !== 'real') {
      throw new Error(`PAYOUT_GATEWAY_MODE không hợp lệ: "${mode}" (chỉ nhận console | real)`);
    }

    throw new NotImplementedException(
      'MomoPayoutService.verifyWebhookSignature (real mode) chưa biết thuật toán ký thật của Momo ' +
        '— cần tài liệu API chính thức trước khi implement.',
    );
  }
}
