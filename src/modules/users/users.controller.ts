import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { SetFixedAreaDto } from './dto/set-fixed-area.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024;

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

  // Ảnh đại diện (tai-lieu-chuc-nang.md #37) — multipart riêng như POST posts/images, nhưng gán
  // thẳng vào User (1:1, không cần bước 2 gắn URL vào DTO khác).
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  updateAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Thiếu file ảnh');
    }
    return this.usersService.updateAvatar(user.id, file);
  }

  // Hồ sơ công khai người khác (tai-lieu-chuc-nang.md #36) — ĐẶT CUỐI CÙNG: ':id' khớp mọi segment
  // đơn, khai báo trước sẽ nuốt mất các route tĩnh 'me', 'me/areas'... ở trên.
  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
