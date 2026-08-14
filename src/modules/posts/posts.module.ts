import { Module } from '@nestjs/common';

import { MerchantsModule } from '../merchants/merchants.module';
import { ModerationModule } from '../moderation/moderation.module';
import { UsersModule } from '../users/users.module';

import { PostAuthorQueryService } from './post-author-query.service';
import { PostViewsService } from './post-views.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { RankingService } from './ranking.service';

@Module({
  imports: [UsersModule, MerchantsModule, ModerationModule],
  controllers: [PostsController],
  providers: [PostsService, RankingService, PostViewsService, PostAuthorQueryService],
  exports: [PostsService, PostViewsService],
})
export class PostsModule {}
