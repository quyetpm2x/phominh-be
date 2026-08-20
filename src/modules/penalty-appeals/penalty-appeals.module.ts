import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AdminPenaltyAppealsController } from './admin-penalty-appeals.controller';
import { PenaltyAppealsController } from './penalty-appeals.controller';
import { PenaltyAppealsService } from './penalty-appeals.service';

@Module({
  imports: [PrismaModule],
  controllers: [PenaltyAppealsController, AdminPenaltyAppealsController],
  providers: [PenaltyAppealsService],
})
export class PenaltyAppealsModule {}
