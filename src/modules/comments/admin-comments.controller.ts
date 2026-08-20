import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { CommentsService } from './comments.service';
import { HideCommentDto } from './dto/hide-comment.dto';

// Admin ẩn bình luận bất kỳ — ngoài phạm vi 117 mục gốc, mở rộng cùng mục 120 (quản lý bài đăng,
// modules/posts/admin-posts.controller.ts). Ẩn 1 bình luận gốc tự động ẩn theo mọi reply trực tiếp
// (CommentsService.cascadeHideReplies). Tái dùng quyền `moderate_posts` thay vì tách riêng
// moderate_comments_public/private — modal chi tiết bài đăng không hiện nội dung bình luận riêng
// tư nên hành động ẩn ở đây không thật sự chạm dữ liệu nhạy cảm cần tách quyền.
@ApiTags('admin-comments')
@Controller('api')
export class AdminCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('moderate_posts')
  @Patch('admin/comments/:id/hide')
  hide(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: HideCommentDto,
  ) {
    return this.commentsService.adminHide(id, admin.id, dto.reason);
  }
}
