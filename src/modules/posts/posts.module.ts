import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { RankingService } from './ranking.service';

@Module({
  imports: [UsersModule],
  controllers: [PostsController],
  providers: [PostsService, RankingService],
  exports: [PostsService],
})
export class PostsModule {}
