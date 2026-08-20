import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { VotesModule } from '../votes/votes.module';

import { AdminCommentsController } from './admin-comments.controller';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [NotificationsModule, VotesModule],
  controllers: [CommentsController, AdminCommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
