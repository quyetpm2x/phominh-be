import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EsmsResponse {
  CodeResult: string;
  SMSID?: string;
  ErrorMessage?: string;
}

// Gọi eSMS.vn thật (SendMultipleMessage_V4_post_json) — field/endpoint xác nhận từ
// developers.esms.vn ngày viết code này, kiểm tra lại nếu eSMS đổi API. 3 mode qua SMS_OTP_MODE,
// mặc định "console" để KHÔNG tốn phí SMS khi chạy dev hàng ngày (xem tai-lieu-chi-tiet-chuc-nang.md
// mục "Môi trường dev" — cách tránh chi phí SMS).
@Injectable()
export class SmsOtpService {
  private readonly logger = new Logger(SmsOtpService.name);

  constructor(private readonly config: ConfigService) {}

  // phoneDomestic: dạng nội địa 0xxxxxxxxx (đã convert bởi caller qua toDomesticPhoneFormat) — eSMS
  // không nhận E.164.
  async sendSms(phoneDomestic: string, otp: string): Promise<{ smsId: string }> {
    const mode = this.config.get<string>('SMS_OTP_MODE', 'console');

    if (mode === 'console') {
      this.logger.warn(
        `[DEV — SMS_OTP_MODE=console, không gọi eSMS thật] OTP cho ${phoneDomestic}: ${otp}`,
      );
      return { smsId: 'dev-console' };
    }

    if (mode !== 'sandbox' && mode !== 'real') {
      throw new Error(`SMS_OTP_MODE không hợp lệ: "${mode}" (chỉ nhận console | sandbox | real)`);
    }

    const res = await fetch(
      'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ApiKey: this.config.getOrThrow<string>('SMS_OTP_API_KEY'),
          SecretKey: this.config.getOrThrow<string>('SMS_OTP_SECRET_KEY'),
          Phone: phoneDomestic,
          Content: `Ma xac thuc Pho Minh cua ban la ${otp}. Ma het hieu luc sau 5 phut, khong chia se voi bat ky ai.`,
          Brandname: this.config.getOrThrow<string>('SMS_OTP_BRANDNAME'),
          SmsType: '2',
          IsUnicode: '0', // không dấu — tránh SMS bị tính thành nhiều segment (70 vs 160 ký tự/segment)
          Sandbox: mode === 'sandbox' ? '1' : '0',
        }),
      },
    );

    const data = (await res.json()) as EsmsResponse;
    // CodeResult=100 nghĩa là eSMS đã NHẬN request, chưa chắc SMS đã tới máy — muốn chắc chắn cần
    // khai báo CallbackUrl (webhook), bỏ qua ở MVP theo tai-lieu-chi-tiet-chuc-nang.md.
    if (data.CodeResult !== '100') {
      throw new Error(
        `eSMS gửi thất bại: CodeResult=${data.CodeResult} ${data.ErrorMessage ?? ''}`,
      );
    }
    return { smsId: data.SMSID ?? '' };
  }
}
