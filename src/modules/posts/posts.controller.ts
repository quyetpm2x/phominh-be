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
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { CreatePostDto } from './dto/create-post.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostAuthorQueryService } from './post-author-query.service';
import { PostViewsService } from './post-views.service';
import { PostsService } from './posts.service';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

@ApiTags('posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postViewsService: PostViewsService,
    private readonly postAuthorQueryService: PostAuthorQueryService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  // multipart/form-data riêng — client upload ẢNH trước, lấy URL trả về gắn vào CreatePostDto.imageUrls
  // ở bước gọi POST / kế tiếp. memoryStorage() giữ file trong RAM (không ghi tạm ra đĩa) vì chuyển
  // thẳng buffer lên Supabase Storage ngay, ảnh đã nén phía client nên kích thước nhỏ.
  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    }),
  )
  uploadImage(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Thiếu file ảnh');
    }
    return this.postsService.uploadImage(user.id, file);
  }

  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.postsService.findNearby(query, user.id);
  }

  // "Bài đã đăng" trong hồ sơ (tai-lieu-chuc-nang.md #35) — ĐẶT TRƯỚC ':id' bên dưới, nếu không
  // 'mine' sẽ bị ':id' nuốt mất (Nest khớp route theo thứ tự khai báo).
  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.postAuthorQueryService.findMine(user.id);
  }

  // Bài công khai của người khác, dùng ở hồ sơ công khai (tai-lieu-chuc-nang.md #36).
  @Get('by-user/:userId')
  findByAuthor(@Param('userId') userId: string) {
    return this.postAuthorQueryService.findByAuthor(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postsService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postsService.remove(id, user.id);
  }

  // Thống kê "ai đã xem bài" (tai-lieu-chuc-nang.md #44) — client gọi khi mở màn chi tiết.
  @Post(':id/views')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordView(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postViewsService.recordView(id, user.id);
  }

  @Get(':id/views/count')
  getViewCount(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postViewsService.getViewCount(id, user.id);
  }
}
