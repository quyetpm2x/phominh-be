import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AppSessionsController } from './app-sessions.controller';
import { AppSessionsService } from './app-sessions.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppSessionsController],
  providers: [AppSessionsService],
})
export class AppSessionsModule {}
