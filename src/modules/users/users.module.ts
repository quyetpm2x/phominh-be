import { Module } from '@nestjs/common';

import { LegalDocumentsModule } from '../legal-documents/legal-documents.module';

import { AccountDeletionCronService } from './account-deletion-cron.service';
import { AccountLifecycleController } from './account-lifecycle.controller';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AdminUserQueriesService } from './admin-user-queries.service';
import { TrustHistoryService } from './trust-history.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [LegalDocumentsModule],
  controllers: [UsersController, AccountLifecycleController],
  providers: [
    UsersService,
    AccountLifecycleService,
    AccountDeletionCronService,
    TrustHistoryService,
    AdminUserQueriesService,
  ],
  exports: [UsersService, AccountLifecycleService],
})
export class UsersModule {}
