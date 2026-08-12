// Dependency Inversion CHỈ áp dụng ở đây và payout-gateway/ — nơi rủi ro tiền thật cao nhất, cần dễ
// mock khi test và dễ audit độc lập (tai-lieu-cong-nghe-backend.md §2.3a). Không áp dụng pattern
// này cho mapbox/sms-otp/vision-api — rủi ro thấp hơn nhiều, thêm interface ở đó là thừa.

export interface PaymentResult {
  providerTransactionId: string;
  status: 'pending' | 'success' | 'failed';
  redirectUrl?: string; // 1 số cổng (VNPay) cần redirect user sang trang thanh toán
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface IPaymentGateway {
  createPayment(amountVnd: number, orderId: string): Promise<PaymentResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
}
