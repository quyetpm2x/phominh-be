import { Module } from '@nestjs/common';

import { PilotAreasController } from './pilot-areas.controller';
import { PilotAreasService } from './pilot-areas.service';

@Module({
  controllers: [PilotAreasController],
  providers: [PilotAreasService],
})
export class PilotAreasModule {}
