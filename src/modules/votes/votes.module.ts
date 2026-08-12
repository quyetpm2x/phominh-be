import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';

// TrustScoreService KHÔNG khai báo ở đây — đến từ TrustScoreModule @Global (xem trust-score.module.ts)
// để tránh vòng lặp import với UsersModule (UsersService cũng cần TrustScoreService).
@Module({
  imports: [UsersModule],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}
