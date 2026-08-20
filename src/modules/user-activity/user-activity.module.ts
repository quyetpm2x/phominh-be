import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { UserActivityController } from './user-activity.controller';
import { UserActivityService } from './user-activity.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserActivityController],
  providers: [UserActivityService],
})
export class UserActivityModule {}
