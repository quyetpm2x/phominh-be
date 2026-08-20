import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { AdminPostQueriesService } from './admin-post-queries.service';
import { HidePostDto } from './dto/hide-post.dto';

// Quản lý bài đăng cho admin — ngoài phạm vi 117 mục gốc (tai-lieu-chuc-nang.md mục 120).
// '@Controller(\'api\')' vì route admin/* nằm cạnh route mobile/* trong cùng module (cùng pattern
// account-lifecycle.controller.ts), khác PostsController vốn chỉ phục vụ api/mobile/posts.
@ApiTags('admin-posts')
@Controller('api')
export class AdminPostsController {
  constructor(private readonly adminPostQueries: AdminPostQueriesService) {}

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('view_posts')
  @Get('admin/posts')
  list(@Query('page') page?: string) {
    return this.adminPostQueries.list(page ? Number.parseInt(page, 10) : 1);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('view_posts')
  @Get('admin/posts/:id')
  getDetail(@Param('id') id: string) {
    return this.adminPostQueries.getDetail(id);
  }

  // Ẩn trực tiếp, không kèm phạt điểm uy tín tác giả — khác luồng report B1 (ReportsService,
  // xác nhận VI PHẠM mới trừ điểm). Muốn phạt điểm thì xử lý qua report đúng luồng đó. Bắt buộc
  // ghi lý do (HidePostDto), ghi vào AdminActionLog.
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('moderate_posts')
  @Patch('admin/posts/:id/hide')
  hide(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: HidePostDto,
  ) {
    return this.adminPostQueries.hide(id, admin.id, dto.reason);
  }
}
