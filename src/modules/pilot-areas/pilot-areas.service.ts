import { Injectable, NotFoundException } from '@nestjs/common';
import type { PilotArea } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreatePilotAreaDto } from './dto/create-pilot-area.dto';

export interface PilotAreaWithStats extends PilotArea {
  userCount: number;
  postCount: number;
  merchantCount: number;
}

// Quản lý khu vực thí điểm (tai-lieu-chuc-nang.md #101) — trước đây KHÔNG có khái niệm "khu vực
// chính thức" nào trong data model, chỉ có FixedArea cá nhân từng user. isActive THUẦN TUÝ là cờ
// nội bộ cho admin theo dõi — không chặn/ảnh hưởng gì tới feed hay đăng bài thật (xem comment ở
// PilotArea trong schema.prisma).
@Injectable()
export class PilotAreasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePilotAreaDto): Promise<PilotArea> {
    return this.prisma.pilotArea.create({
      data: { name: dto.name, lat: dto.lat, lng: dto.lng, radiusKm: dto.radiusKm },
    });
  }

  async setActive(id: string, isActive: boolean): Promise<PilotArea> {
    const area = await this.prisma.pilotArea.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Không tìm thấy khu vực thí điểm');
    return this.prisma.pilotArea.update({ where: { id }, data: { isActive } });
  }

  // So sánh số liệu giữa các khu (tai-lieu-chuc-nang.md #101) — số lượng khu vực thí điểm dự kiến
  // nhỏ (vài chục), nên tính riêng từng khu bằng PostGIS thay vì 1 truy vấn tổng hợp phức tạp.
  async listWithStats(): Promise<PilotAreaWithStats[]> {
    const areas = await this.prisma.pilotArea.findMany({ orderBy: { createdAt: 'desc' } });
    return Promise.all(areas.map((area) => this.withStats(area)));
  }

  // Post tính trong 30 ngày gần nhất (hoạt động gần đây, không phải toàn bộ lịch sử) — khớp cách
  // PostsService.findNearby dùng ST_DWithin trực tiếp trên geography column, không cần bảng phụ.
  private async withStats(area: PilotArea): Promise<PilotAreaWithStats> {
    const radiusMeters = area.radiusKm * 1000;

    const [userRows, postRows, merchantRows] = await Promise.all([
      this.prisma.$queryRaw<{ count: bigint }[]>`
        select count(*) as count from fixed_areas fa
        where fa.label = 'home'
          and ST_DWithin(fa.location, ST_SetSRID(ST_MakePoint(${area.lng}, ${area.lat}), 4326)::geography, ${radiusMeters})
      `,
      this.prisma.$queryRaw<{ count: bigint }[]>`
        select count(*) as count from posts p
        where p.status = 'active' and p.created_at > now() - interval '30 days'
          and ST_DWithin(p.posted_location, ST_SetSRID(ST_MakePoint(${area.lng}, ${area.lat}), 4326)::geography, ${radiusMeters})
      `,
      this.prisma.$queryRaw<{ count: bigint }[]>`
        select count(*) as count from merchant_profiles mp
        where ST_DWithin(mp.location, ST_SetSRID(ST_MakePoint(${area.lng}, ${area.lat}), 4326)::geography, ${radiusMeters})
      `,
    ]);

    return {
      ...area,
      userCount: Number(userRows[0].count),
      postCount: Number(postRows[0].count),
      merchantCount: Number(merchantRows[0].count),
    };
  }
}
