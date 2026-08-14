import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push-tokens')
  registerPushToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPushTokenDto) {
    return this.notificationsService.registerPushToken(user.id, dto);
  }

  @Get('settings')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getDigestSettings(user.id);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateDigestSettings(user.id, dto);
  }

  // Danh sách thông báo (tai-lieu-chuc-nang.md #47).
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listNotifications(user.id);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
