import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { CreateSeedPostDto } from './dto/create-seed-post.dto';
import { SeedContentService } from './seed-content.service';

// Đăng bài mồi thủ công (tai-lieu-chuc-nang.md #100, ScreenId E1).
@ApiTags('seed-content')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('seed_content')
@Controller('api/admin/seed-content')
export class SeedContentController {
  constructor(private readonly service: SeedContentService) {}

  @Post()
  create(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CreateSeedPostDto) {
    return this.service.createSeedPost(dto, admin.id);
  }

  @Get()
  list() {
    return this.service.listSeeded();
  }
}
