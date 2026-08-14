import { Module } from '@nestjs/common';

import { ModerationModule } from '../moderation/moderation.module';

import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';

@Module({
  imports: [ModerationModule],
  controllers: [EmergencyController],
  providers: [EmergencyService],
})
export class EmergencyModule {}
