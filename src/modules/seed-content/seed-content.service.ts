import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';

const SEED_AUTHOR_PHONE = '+840000000001';
const SEED_AUTHOR_ALIAS = 'Đội ngũ Phố Mình';
const LIST_LIMIT = 50;

// Đăng bài mồi thủ công (tai-lieu-chuc-nang.md #100) — trước đây permission `seed_content` chỉ
// khai báo, không route/service nào dùng. Tái dùng ĐÚNG PostsService.create() (cùng luồng bài đăng
// thật, KHÔNG viết lại) — chỉ khác chỗ authorId trỏ về 1 User "hệ thống" cố định (đăng nhập/OTP
// không áp dụng cho tài khoản này, chỉ tồn tại để làm authorId hợp lệ) thay vì user thật, và đánh
// dấu isSeeded=true SAU KHI tạo (theo dõi nội bộ, không hiện với user thường).
@Injectable()
export class SeedContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
  ) {}

  private async getOrCreateSeedAuthorId(): Promise<string> {
    const existing = await this.prisma.user.findUnique({
      where: { phoneNumber: SEED_AUTHOR_PHONE },
    });
    if (existing) return existing.id;
    const created = await this.prisma.user.create({
      data: { phoneNumber: SEED_AUTHOR_PHONE, alias: SEED_AUTHOR_ALIAS },
    });
    return created.id;
  }

  async createSeedPost(
    dto: { pilotAreaId: string; content: string; postType: 'life' | 'merchant' | 'emergency' },
    adminId: string,
  ) {
    const area = await this.prisma.pilotArea.findUnique({ where: { id: dto.pilotAreaId } });
    if (!area) throw new NotFoundException('Không tìm thấy khu vực thí điểm');

    const authorId = await this.getOrCreateSeedAuthorId();
    const post = await this.posts.create(authorId, {
      postType: dto.postType,
      content: dto.content,
      lat: area.lat,
      lng: area.lng,
      displayMode: 'alias',
    });

    await this.prisma.$transaction([
      this.prisma.post.update({ where: { id: post.id }, data: { isSeeded: true } }),
      this.prisma.adminActionLog.create({
        data: {
          adminUserId: adminId,
          action: 'seed_post',
          targetType: 'post',
          targetId: post.id,
        },
      }),
    ]);

    return { id: post.id };
  }

  async listSeeded() {
    const posts = await this.prisma.post.findMany({
      where: { isSeeded: true },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    return posts.map((p) => ({
      id: p.id,
      content: p.content,
      postType: p.postType,
      lat: p.lat,
      lng: p.lng,
      createdAt: p.createdAt,
    }));
  }
}
