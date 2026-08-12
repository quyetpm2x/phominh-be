import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { SetFixedAreaDto } from './dto/set-fixed-area.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  // 2 khu vực cố định — CHỈ quyết định user XEM feed nào, không ảnh hưởng vị trí bài user tự đăng
  // (bussiness §2.1).
  @Post('me/areas')
  setFixedArea(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetFixedAreaDto) {
    return this.usersService.setFixedArea(user.id, dto);
  }

  @Get('me/areas')
  getFixedAreas(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getFixedAreas(user.id);
  }

  // "Không quan tâm" (tai-lieu-chuc-nang.md #32) — ẩn thầm lặng 1 người khỏi feed của chính mình.
  @Post('me/ignored-users/:userId')
  ignoreUser(@CurrentUser() user: AuthenticatedUser, @Param('userId') targetUserId: string) {
    return this.usersService.ignoreUser(user.id, targetUserId);
  }

  @Delete('me/ignored-users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unignoreUser(@CurrentUser() user: AuthenticatedUser, @Param('userId') targetUserId: string) {
    return this.usersService.unignoreUser(user.id, targetUserId);
  }

  @Get('me/ignored-users')
  listIgnoredUsers(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listIgnoredUsers(user.id);
  }
}
