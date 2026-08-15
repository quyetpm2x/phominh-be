import { Module } from '@nestjs/common';

import { MarketingLeadsAdminController } from './marketing-leads-admin.controller';
import { PublicLeadsController } from './public-leads.controller';
import { PublicLeadsService } from './public-leads.service';

@Module({
  controllers: [PublicLeadsController, MarketingLeadsAdminController],
  providers: [PublicLeadsService],
})
export class PublicModule {}
