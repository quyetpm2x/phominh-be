import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Post } from '@prisma/client';

import { SupabaseService } from '../../integrations/supabase/supabase.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantsService } from '../merchants/merchants.service';
import { ModerationService } from '../moderation/moderation.service';
import { UsersService } from '../users/users.service';

import type { CreatePostDto } from './dto/create-post.dto';
import type { NearbyQueryDto } from './dto/nearby-query.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import { isPostModifiable } from './post-lifecycle.util';
import { engagementWeight, toBaseSummary, type NearbyRow, type PostRow } from './post-row.util';
import { RankingService } from './ranking.service';

const MERCHANT_POST_TTL_HOURS = 24; // Story-style, tự ẩn sau 24h (bussiness mục 3)
const LIFE_POST_TTL_HOURS = 48; // Bài đời sống thường — đúng copy "Tự ẩn sau 48 giờ" ở màn soạn bài
const NEARBY_RESULT_LIMIT = 200;
const POST_IMAGES_BUCKET = 'post-images';
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_BADGE_LABEL = '🌱 Người mới';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RankingService,
    private readonly supabase: SupabaseService,
    private readonly usersService: UsersService,
    private readonly merchantsService: MerchantsService,
    private readonly moderationService: ModerationService,
  ) {}

  async create(authorId: string, dto: CreatePostDto): Promise<Post> {
    // emergency KHÔNG có hạn tự ẩn (null) — chỉ hết hiệu lực qua xác minh đa nguồn (modules/emergency),
    // không phải hết giờ như 2 loại còn lại.
    this.moderationService.checkMockGps(dto.isMockLocation ?? false);
    if (dto.isLibraryPhoto) {
      await this.merchantsService.assertVerifiedForLibraryPhoto(authorId);
    }

    let expiresAt: Date | null = null;
    if (dto.postType === 'merchant') {
      expiresAt = new Date(Date.now() + MERCHANT_POST_TTL_HOURS * 60 * 60 * 1000);
    } else if (dto.postType === 'life') {
      expiresAt = new Date(Date.now() + LIFE_POST_TTL_HOURS * 60 * 60 * 1000);
    }

    const post = await this.prisma.post.create({
      data: {
        authorId,
        postType: dto.postType,
        content: dto.content,
        lat: dto.lat,
        lng: dto.lng,
        displayMode: dto.displayMode ?? 'alias',
        isLibraryPhoto: dto.isLibraryPhoto ?? false,
        expiresAt,
        textColor: dto.textColor,
        backgroundColor: dto.backgroundColor,
        fontSize: dto.fontSize,
        images: dto.imageUrls?.length
          ? { create: dto.imageUrls.map((url, sortOrder) => ({ url, sortOrder })) }
          : undefined,
      },
    });
    await this.syncGeographyColumn(post.id, dto.lat, dto.lng);
    return post;
  }

  // Sửa bài đăng của chính mình (tai-lieu-chuc-nang.md #33) — chỉ sửa content + style, xem
  // UpdatePostDto vì sao không cho sửa ảnh/vị trí/loại bài. Field style không gửi lên = giữ nguyên
  // giá trị cũ (Prisma bỏ qua field undefined trong data).
  async update(id: string, authorId: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.findOwnedActivePost(id, authorId);
    return this.prisma.post.update({
      where: { id: post.id },
      data: {
        content: dto.content,
        textColor: dto.textColor,
        backgroundColor: dto.backgroundColor,
        fontSize: dto.fontSize,
      },
    });
  }

  // Xoá bài đăng của chính mình — soft delete (status='removed'), tận dụng cột PostStatus có sẵn:
  // findOne/findNearby đã lọc status='active' nên bài biến mất khỏi feed/chi tiết ngay, không cần
  // sửa gì thêm ở 2 hàm đó. Giữ nguyên record (không hard delete) để không cascade xoá comments/
  // reports/emergency confirmations liên quan (bussiness — cần giữ vết cho khiếu nại/kiểm duyệt).
  async remove(id: string, authorId: string): Promise<void> {
    const post = await this.findOwnedActivePost(id, authorId);
    await this.prisma.post.update({ where: { id: post.id }, data: { status: 'removed' } });
  }

  private async findOwnedActivePost(id: string, authorId: string): Promise<Post> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Không tìm thấy bài đăng');
    if (post.authorId !== authorId) {
      throw new ForbiddenException('Chỉ tác giả mới được sửa/xoá bài đăng này');
    }
    if (!isPostModifiable(post, new Date())) {
      throw new ForbiddenException('Bài đăng đã hết hạn hoặc đã bị xoá, không thể sửa/xoá');
    }
    return post;
  }

  // Upload lên Supabase Storage (bucket public, xem scripts/setup-storage-bucket.ts) — trả về URL
  // công khai để client gắn vào CreatePostDto.imageUrls ở bước tạo bài kế tiếp. Tách riêng route
  // khỏi POST / vì đây là multipart/form-data, không phải JSON như phần còn lại của API.
  async uploadImage(userId: string, file: Express.Multer.File): Promise<{ url: string }> {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Chỉ nhận ảnh JPEG/PNG/WebP');
    }
    const extension = file.mimetype.split('/')[1];
    const path = `${userId}/${randomUUID()}.${extension}`;

    const { error } = await this.supabase.client.storage
      .from(POST_IMAGES_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype });
    if (error) {
      throw new BadRequestException(`Upload ảnh thất bại: ${error.message}`);
    }

    const { data } = this.supabase.client.storage.from(POST_IMAGES_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl };
  }

  // Chi tiết 1 bài (Tầng 2 task 11) — trả cùng shape enrich như findNearby (trừ distanceMeters/score,
  // vốn cần toạ độ người xem) để 1 PostDetail type dùng chung ở frontend.
  async findOne(id: string) {
    const rows = await this.prisma.$queryRaw<PostRow[]>`
      select p.id, p.author_id, p.post_type, p.status, p.content, p.lat, p.lng, p.display_mode, p.is_library_photo,
        p.vote_count, p.comment_count, p.expires_at, p.created_at,
        p.text_color, p.background_color, p.font_size,
        u.alias as author_alias, u.real_name as author_real_name,
        (select pi.url from post_images pi where pi.post_id = p.id order by pi.sort_order asc limit 1) as image_url
      from posts p
      join users u on u.id = p.author_id
      where p.id = ${id}::uuid and p.status = 'active'
    `;
    const row = rows[0];
    if (!row) throw new NotFoundException('Không tìm thấy bài đăng');

    const badges = await this.usersService.getBadgeLabelsForUsers([row.author_id]);
    return {
      ...toBaseSummary(row),
      authorBadge: badges.get(row.author_id) ?? DEFAULT_BADGE_LABEL,
    };
  }

  // PostGIS lọc thô (ST_DWithin) + Service tính điểm đầy đủ — đúng nguyên tắc tai-lieu-cong-nghe
  // §7.1: SQL không tự tính công thức xếp hạng, chỉ trả candidate trong bán kính kèm khoảng cách.
  async findNearby(query: NearbyQueryDto, viewerId: string) {
    const radiusKm = query.radiusKm ?? 2;
    const radiusMeters = radiusKm * 1000;

    const postTypeFilter = query.postType
      ? Prisma.sql`and p.post_type = ${query.postType}`
      : Prisma.empty;

    // "Không quan tâm" (tai-lieu-chuc-nang.md #32) — bài của người viewer đã ẩn không xuất hiện lại
    // trong feed của chính họ. TRỪ tin khẩn cấp — không được để lỡ cảnh báo an toàn chỉ vì đã ẩn
    // người đăng (bussiness §3, bài học vụ Gas app đã nhắc — ưu tiên an toàn hơn sở thích cá nhân).
    const ignoredUserIds = await this.usersService.getIgnoredUserIds(viewerId);
    const ignoredFilter =
      ignoredUserIds.length > 0
        ? Prisma.sql`and (p.post_type = 'emergency' or p.author_id not in (${Prisma.join(ignoredUserIds)}))`
        : Prisma.empty;

    // Join users lấy tên hiển thị (PostCard cần tên tác giả) + subquery lấy URL ảnh đầu tiên (feed
    // chỉ cần 1 ảnh thumbnail, không phải toàn bộ mảng images như findOne).
    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      select p.id, p.author_id, p.post_type, p.status, p.content, p.lat, p.lng, p.display_mode, p.is_library_photo,
        p.vote_count, p.comment_count, p.expires_at, p.created_at,
        p.text_color, p.background_color, p.font_size,
        u.alias as author_alias, u.real_name as author_real_name,
        (select pi.url from post_images pi where pi.post_id = p.id order by pi.sort_order asc limit 1) as image_url,
        ST_Distance(p.posted_location, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography) as distance_m
      from posts p
      join users u on u.id = p.author_id
      where p.status = 'active'
        and (p.expires_at is null or p.expires_at > now())
        and ST_DWithin(p.posted_location, ST_SetSRID(ST_MakePoint(${query.lng}, ${query.lat}), 4326)::geography, ${radiusMeters})
        ${postTypeFilter}
        ${ignoredFilter}
      order by p.created_at desc
      limit ${NEARBY_RESULT_LIMIT}
    `;

    const badges = await this.usersService.getBadgeLabelsForUsers(rows.map((r) => r.author_id));

    return rows
      .map((row) => ({
        ...toBaseSummary(row),
        authorBadge: badges.get(row.author_id) ?? DEFAULT_BADGE_LABEL,
        distanceMeters: Math.round(row.distance_m),
        score: this.ranking.calculateScore({
          postType: row.post_type,
          createdAt: row.created_at,
          isLibraryPhoto: row.is_library_photo,
          distanceMeters: row.distance_m,
          engagementWeight: engagementWeight(row.vote_count, row.comment_count),
          maxRadiusKm: radiusKm,
        }),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private async syncGeographyColumn(postId: string, lat: number, lng: number): Promise<void> {
    await this.prisma.$executeRaw`
      update posts
      set posted_location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      where id = ${postId}::uuid
    `;
  }
}
