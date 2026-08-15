export interface PayoutResult {
  providerTransactionId: string;
  status: 'processing' | 'success' | 'failed';
}

export const PAYOUT_GATEWAY = Symbol('PAYOUT_GATEWAY');

// Luồng 2 (tiền ra, bussiness §11.2) — app KHÔNG tự làm trung gian thanh toán, chỉ gọi API chi hộ
// của Momo/VNPay để chuyển thẳng về ngân hàng user. Cần bọc thêm Circuit Breaker (opossum) khi nối
// API thật — liên quan tiền thật, không để request treo/lặp vô tội vạ khi đối tác sập tạm thời
// (tai-lieu-cong-nghe-backend.md §2.4). Chưa cài opossum ở scaffold này vì chưa có lệnh gọi thật để
// bọc — thêm khi implement momo-payout.service.ts đầy đủ.
export interface IPayoutGateway {
  transfer(amountVnd: number, bankAccountId: string): Promise<PayoutResult>;
  // Xác thực chữ ký webhook callback trạng thái chi hộ — rawBody PHẢI là chuỗi gốc đối tác gửi lên,
  // không phải JSON đã parse lại rồi stringify (thứ tự field khác đi là chữ ký sai).
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}
