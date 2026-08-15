import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';

import {
  PAYOUT_GATEWAY,
  type IPayoutGateway,
} from '../../integrations/payout-gateway/payout-gateway.interface';

import { PaymentsService } from './payments.service';

interface PayoutWebhookBody {
  providerTransactionId: string;
  status: 'success' | 'failed';
}

// Callback trạng thái chi hộ từ đối tác (bussiness §5.1e) — KHÔNG đặt sau JwtAuthGuard (đối tác gọi
// thẳng, không có JWT user), bảo mật bằng verify chữ ký HMAC (IPayoutGateway.verifyWebhookSignature)
// thay thế. Ẩn khỏi Swagger vì đây là endpoint nội bộ dành cho đối tác, không phải client app.
@ApiExcludeController()
@Controller('webhooks/payout')
export class PayoutWebhookController {
  constructor(
    private readonly paymentsService: PaymentsService,
    @Inject(PAYOUT_GATEWAY) private readonly payoutGateway: IPayoutGateway,
  ) {}

  @Post('momo')
  async handleMomoWebhook(@Req() req: RawBodyRequest<Request>): Promise<{ received: boolean }> {
    const signature = req.headers['x-payout-signature'];
    if (typeof signature !== 'string' || !req.rawBody) {
      throw new BadRequestException('Thiếu chữ ký hoặc body webhook');
    }
    const isValid = this.payoutGateway.verifyWebhookSignature(
      req.rawBody.toString('utf8'),
      signature,
    );
    if (!isValid) throw new BadRequestException('Chữ ký webhook không hợp lệ');

    const body = req.body as PayoutWebhookBody;
    await this.paymentsService.handlePayoutWebhook(body.providerTransactionId, body.status);
    return { received: true };
  }
}
