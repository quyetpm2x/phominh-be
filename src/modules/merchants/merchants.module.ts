import { Module } from '@nestjs/common';

import { AdminMerchantsController } from './admin-merchants.controller';
import { AdminPhoneVisibilityMonitorService } from './admin-phone-visibility-monitor.service';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';

@Module({
  controllers: [MerchantsController, AdminMerchantsController],
  providers: [MerchantsService, AdminPhoneVisibilityMonitorService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
