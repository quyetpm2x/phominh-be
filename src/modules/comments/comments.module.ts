import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { VotesModule } from '../votes/votes.module';

import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [NotificationsModule, VotesModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
