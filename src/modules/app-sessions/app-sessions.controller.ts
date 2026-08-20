import { Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { AppSessionsService } from './app-sessions.service';

@ApiTags('app-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/app-sessions')
export class AppSessionsController {
  constructor(private readonly service: AppSessionsService) {}

  @Post()
  start(@CurrentUser() user: AuthenticatedUser) {
    return this.service.start(user.id);
  }

  @Patch(':id/close')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.close(user.id, id);
  }
}
