import { Module } from '@nestjs/common';

import { PAYMENT_GATEWAY } from '../../integrations/payment-gateway/payment-gateway.interface';
import { VnpayPaymentService } from '../../integrations/payment-gateway/vnpay-payment.service';
import { MomoPayoutService } from '../../integrations/payout-gateway/momo-payout.service';
import { PAYOUT_GATEWAY } from '../../integrations/payout-gateway/payout-gateway.interface';
import { RewardsModule } from '../rewards/rewards.module';

import { AdminPayoutQueriesService } from './admin-payout-queries.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PayoutWebhookController } from './payout-webhook.controller';

// Dependency Inversion (tai-lieu-cong-nghe-backend §2.3a) — PaymentsService chỉ biết interface, đổi
// đối tác thanh toán sau này chỉ cần đổi useClass ở đây, không sửa PaymentsService. Import
// RewardsModule để lấy RewardWalletService — payout trừ/hoàn thẳng vào ví thưởng (bussiness §5.1e).
// AdminPayoutQueriesService tách riêng khỏi PaymentsService (đúng pattern ReportQueriesService) chỉ
// để đọc dữ liệu cho hàng đợi duyệt admin, không đụng luồng ghi/gateway.
@Module({
  imports: [RewardsModule],
  controllers: [PaymentsController, PayoutWebhookController],
  providers: [
    PaymentsService,
    AdminPayoutQueriesService,
    { provide: PAYMENT_GATEWAY, useClass: VnpayPaymentService },
    { provide: PAYOUT_GATEWAY, useClass: MomoPayoutService },
  ],
})
export class PaymentsModule {}
