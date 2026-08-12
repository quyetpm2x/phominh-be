import { Module } from '@nestjs/common';

import { PAYMENT_GATEWAY } from '../../integrations/payment-gateway/payment-gateway.interface';
import { VnpayPaymentService } from '../../integrations/payment-gateway/vnpay-payment.service';
import { MomoPayoutService } from '../../integrations/payout-gateway/momo-payout.service';
import { PAYOUT_GATEWAY } from '../../integrations/payout-gateway/payout-gateway.interface';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

// Dependency Inversion (tai-lieu-cong-nghe-backend §2.3a) — PaymentsService chỉ biết interface, đổi
// đối tác thanh toán sau này chỉ cần đổi useClass ở đây, không sửa PaymentsService.
@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_GATEWAY, useClass: VnpayPaymentService },
    { provide: PAYOUT_GATEWAY, useClass: MomoPayoutService },
  ],
})
export class PaymentsModule {}
