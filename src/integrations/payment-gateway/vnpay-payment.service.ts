import { Injectable, NotImplementedException } from '@nestjs/common';

import type { IPaymentGateway, PaymentResult } from './payment-gateway.interface';

// Stub — Luồng 1 (tiền vào, mục 11.1 tài liệu bussiness): merchant mua gói qua VNPay/Momo/ZaloPay.
// Chưa nối API thật (cần VNPAY_MERCHANT_ID/VNPAY_SECRET_KEY) — bật tính năng này kích hoạt bắt buộc
// xin Giấy phép mạng xã hội (NĐ 147/2024), xem README trước khi implement thật.
@Injectable()
export class VnpayPaymentService implements IPaymentGateway {
  createPayment(_amountVnd: number, _orderId: string): Promise<PaymentResult> {
    throw new NotImplementedException('VnpayPaymentService.createPayment chưa nối VNPay thật');
  }

  verifyWebhookSignature(_rawBody: string, _signatureHeader: string): boolean {
    throw new NotImplementedException(
      'VnpayPaymentService.verifyWebhookSignature chưa nối VNPay thật',
    );
  }
}
