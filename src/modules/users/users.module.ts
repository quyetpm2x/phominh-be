import { Module } from '@nestjs/common';

import { AccountDeletionCronService } from './account-deletion-cron.service';
import { AccountLifecycleController } from './account-lifecycle.controller';
import { AccountLifecycleService } from './account-lifecycle.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, AccountLifecycleController],
  providers: [UsersService, AccountLifecycleService, AccountDeletionCronService],
  exports: [UsersService, AccountLifecycleService],
})
export class UsersModule {}
