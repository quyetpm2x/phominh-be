import { Module } from '@nestjs/common';

import { ModerationModule } from '../moderation/moderation.module';

import { EmergencyAdminController } from './emergency-admin.controller';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';

@Module({
  imports: [ModerationModule],
  controllers: [EmergencyController, EmergencyAdminController],
  providers: [EmergencyService],
})
export class EmergencyModule {}
