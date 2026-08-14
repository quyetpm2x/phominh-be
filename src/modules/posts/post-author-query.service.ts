import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';

import { toBaseSummary, type PostRow } from './post-row.util';

const DEFAULT_BADGE_LABEL = '🌱 Người mới';

// Tách khỏi PostsService (đã chạm giới hạn 250 dòng) — 2 kiểu truy vấn "bài theo tác giả" dùng
// chung 1 câu SQL, chỉ khác điều kiện status (tai-lieu-chuc-nang.md #35, #36).
@Injectable()
export class PostAuthorQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  // "Bài đã đăng" trong hồ sơ chính mình — mọi status TRỪ removed (tự xoá thì không xem lại nữa),
  // để FE tự tách tab "Đang hiện"/"Đã hết hạn" theo field status.
  async findMine(authorId: string) {
    return this.findByAuthorInternal(authorId, Prisma.sql`p.status != 'removed'`);
  }

  // Hồ sơ công khai người khác — CHỈ bài đang hiện, khớp đúng quyền hạn findOne/findNearby (không lộ
  // bài đã hết hạn/đã xoá của người khác).
  async findByAuthor(authorId: string) {
    return this.findByAuthorInternal(authorId, Prisma.sql`p.status = 'active'`);
  }

  private async findByAuthorInternal(authorId: string, statusFilter: Prisma.Sql) {
    const rows = await this.prisma.$queryRaw<PostRow[]>`
      select p.id, p.author_id, p.post_type, p.status, p.content, p.lat, p.lng, p.display_mode, p.is_library_photo,
        p.vote_count, p.comment_count, p.expires_at, p.created_at,
        p.text_color, p.background_color, p.font_size,
        u.alias as author_alias, u.real_name as author_real_name,
        (select pi.url from post_images pi where pi.post_id = p.id order by pi.sort_order asc limit 1) as image_url
      from posts p
      join users u on u.id = p.author_id
      where p.author_id = ${authorId}::uuid and ${statusFilter}
      order by p.created_at desc
    `;
    const badges = await this.usersService.getBadgeLabelsForUsers(rows.map((r) => r.author_id));
    return rows.map((row) => ({
      ...toBaseSummary(row),
      authorBadge: badges.get(row.author_id) ?? DEFAULT_BADGE_LABEL,
    }));
  }
}
