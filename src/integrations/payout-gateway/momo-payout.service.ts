import { Injectable, NotImplementedException } from '@nestjs/common';

import type { IPayoutGateway, PayoutResult } from './payout-gateway.interface';

// Stub — chưa nối API chi hộ Momo thật (cần MOMO_PARTNER_CODE/MOMO_SECRET_KEY). App không giữ tiền
// ở giữa tại bất kỳ thời điểm nào cho luồng này (bussiness §11.2).
@Injectable()
export class MomoPayoutService implements IPayoutGateway {
  transfer(_amountVnd: number, _bankAccountId: string): Promise<PayoutResult> {
    throw new NotImplementedException('MomoPayoutService.transfer chưa nối Momo payout API thật');
  }
}
