import { Injectable } from '@nestjs/common';

// Thuật toán cốt lõi #1 (tai-lieu-cong-nghe-backend.md §7.2 / tài liệu bussiness §7A.2, §7D.1) —
// hàm THUẦN TÚY, không import Prisma/HTTP. Đây là USP của sản phẩm — sai công thức này thì app chỉ
// còn là 1 Facebook Group tầm thường (bussiness §7D.1).

export type RankingPostType = 'life' | 'merchant' | 'emergency';

export interface RankingInput {
  postType: RankingPostType;
  createdAt: Date;
  isLibraryPhoto: boolean;
  distanceMeters: number;
  engagementWeight: number; // tổng hợp vote/bình luận, tính ở nơi gọi (posts.service.ts)
  maxRadiusKm: number;
}

@Injectable()
export class RankingService {
  calculateScore(input: RankingInput, now: Date = new Date()): number {
    const hours = this.getHoursSince(input.createdAt, now);
    const n = this.getDecayExponent(input.postType);
    const distanceFactor = 1 / (1 + input.distanceMeters / 1000 / input.maxRadiusKm);
    const freshnessFactor = 1 / Math.pow(hours + 2, n);
    const photoFactor = input.isLibraryPhoto ? 1.0 : 1.3;
    return (1 + input.engagementWeight) * photoFactor * freshnessFactor * distanceFactor;
  }

  // N=0 khiến Math.pow(x,0)=1 luôn — tin khẩn cấp KHÔNG suy giảm theo thời gian (bussiness §7A.2).
  private getDecayExponent(postType: RankingPostType): number {
    if (postType === 'merchant') return 3.0; // hết hạn 24h nên suy giảm nhanh hơn
    if (postType === 'emergency') return 0;
    return 1.8; // đời sống thường
  }

  private getHoursSince(createdAt: Date, now: Date): number {
    return (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  }
}
