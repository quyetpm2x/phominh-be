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

import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, user.id, dto);
  }

  @Get()
  findAll(@Param('postId') postId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.findForPost(postId, user.id);
  }

  // Chủ bài tự kiểm duyệt bình luận trên bài mình — ghim/ẩn (bussiness §4.1 quy tắc 1).
  @Patch(':commentId/pin')
  pin(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.setPinned(postId, commentId, user.id, true);
  }

  @Patch(':commentId/unpin')
  unpin(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.setPinned(postId, commentId, user.id, false);
  }

  @Patch(':commentId/hide')
  hide(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.setHiddenByOwner(postId, commentId, user.id, true);
  }

  // Tác giả tự sửa/xoá bình luận của chính mình (tai-lieu-chuc-nang.md #34) — khác hẳn pin/hide ở
  // trên, vốn dành cho CHỦ BÀI kiểm duyệt bình luận của NGƯỜI KHÁC.
  @Patch(':commentId')
  update(
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.updateOwn(commentId, user.id, dto);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('commentId') commentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.commentsService.deleteOwn(commentId, user.id);
  }
}
