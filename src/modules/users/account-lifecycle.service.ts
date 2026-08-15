import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AccountStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';

import { computeDaysRemaining } from './account-deletion.util';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdminUserLookupResult {
  id: string;
  alias: string;
  phoneNumber: string;
  realName: string | null;
  accountStatus: AccountStatus;
  statusReason: string | null;
  restrictedUntil: Date | null;
  trustScoreE1: number;
  createdAt: Date;
}

// Khớp đúng "CẬP NHẬT 01/2026" hiện đang hiện ở settings/terms.tsx (mobile) — đổi cả 2 nơi cùng lúc
// khi điều khoản có bản mới, KHÔNG chỉ đổi 1 bên (lệch version thì API tưởng user đã đồng ý bản cũ).
export const CURRENT_TERMS_VERSION = '2026-01';

// Tách khỏi UsersService (đã gần giới hạn 250 dòng) — gồm 3 mảng liên quan tài khoản không phải hồ
// sơ hiển thị: điều khoản (#67), khoá/hạn chế (#74), yêu cầu xoá tài khoản mềm 30 ngày (#69/#73).
@Injectable()
export class AccountLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async acceptTerms(userId: string): Promise<{ version: string; acceptedAt: Date }> {
    return this.prisma.termsAcceptance.create({
      data: { userId, version: CURRENT_TERMS_VERSION },
    });
  }

  async getTermsStatus(userId: string): Promise<{ hasAcceptedLatest: boolean }> {
    const latest = await this.prisma.termsAcceptance.findFirst({
      where: { userId, version: CURRENT_TERMS_VERSION },
    });
    return { hasAcceptedLatest: !!latest };
  }

  // Trạng thái tài khoản (tai-lieu-chuc-nang.md #74) — "restricted" tự hết hiệu lực khi qua
  // restrictedUntil, ghi lại luôn vào DB lúc đọc (lazy-expire) để các chỗ khác đọc trực tiếp
  // accountStatus (không qua hàm này) cũng thấy đúng trạng thái, không chỉ đúng ở response này.
  async getAccountStatus(
    userId: string,
  ): Promise<{ status: AccountStatus; reason: string | null; restrictedUntil: Date | null }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (
      user.accountStatus === 'restricted' &&
      user.restrictedUntil &&
      user.restrictedUntil <= new Date()
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { accountStatus: 'active', statusReason: null, restrictedUntil: null },
      });
      return { status: 'active', reason: null, restrictedUntil: null };
    }
    return {
      status: user.accountStatus,
      reason: user.statusReason,
      restrictedUntil: user.restrictedUntil,
    };
  }

  // Tra cứu trước khi khoá (tai-lieu-chuc-nang.md #95, mock UI gốc "Ô nhập SĐT hoặc mã tài khoản")
  // — trước đây KHÔNG có cách nào để admin tìm ra userId cần khoá dù PATCH .../status đã chạy thật,
  // nên mục 95 đứng yên vô dụng. Dùng chung quyền manage_user_lock, không tạo quyền view riêng vì
  // tra cứu chỉ có ý nghĩa ngay trước hành động khoá/mở khoá.
  async findByPhoneOrId(query: string): Promise<AdminUserLookupResult> {
    const user = await this.prisma.user.findFirst({
      where: UUID_PATTERN.test(query) ? { id: query } : { phoneNumber: query },
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản khớp SĐT/mã tài khoản này');
    return {
      id: user.id,
      alias: user.alias,
      phoneNumber: user.phoneNumber,
      realName: user.realName,
      accountStatus: user.accountStatus,
      statusReason: user.statusReason,
      restrictedUntil: user.restrictedUntil,
      trustScoreE1: user.trustScoreE1,
      createdAt: user.createdAt,
    };
  }

  // Admin khoá/hạn chế/mở lại tài khoản (quyền manage_user_lock, đã seed sẵn ở create-owner.ts) —
  // khoá thì thu hồi luôn mọi refresh token, ép đăng xuất ngay trên mọi thiết bị.
  async setAccountStatus(
    userId: string,
    status: AccountStatus,
    reason: string | null,
    restrictedUntil: Date | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { accountStatus: status, statusReason: reason, restrictedUntil },
    });
    if (status === 'banned') {
      await this.tokenService.revokeAllForUser(userId);
    }
  }

  // Yêu cầu xoá tài khoản (tai-lieu-chuc-nang.md #69/#73, mô hình mềm 30 ngày đã chốt) — ép đăng
  // xuất mọi thiết bị ngay, AccountDeletionCronService hard-delete khi quá hạn.
  async requestDeletion(userId: string): Promise<void> {
    const existing = await this.prisma.dataDeletionRequest.findFirst({
      where: { userId, status: 'requested' },
    });
    if (existing) throw new ForbiddenException('Đã có yêu cầu xoá tài khoản đang chờ xử lý');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date() } }),
      this.prisma.dataDeletionRequest.create({ data: { userId, status: 'requested' } }),
    ]);
    await this.tokenService.revokeAllForUser(userId);
  }

  async getDeletionStatus(
    userId: string,
  ): Promise<{ pending: boolean; daysRemaining: number | null }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.deletionRequestedAt) return { pending: false, daysRemaining: null };

    return {
      pending: true,
      daysRemaining: computeDaysRemaining(user.deletionRequestedAt, new Date()),
    };
  }

  // Đăng nhập lại trong lúc đang chờ xoá => khôi phục (tai-lieu-chuc-nang.md #69/#73) — gọi từ
  // AuthService NGAY SAU KHI verify OTP đúng, trước khi cấp token mới.
  async restoreIfPendingDeletion(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.deletionRequestedAt) return false;

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: null } }),
      this.prisma.dataDeletionRequest.updateMany({
        where: { userId, status: 'requested' },
        data: { status: 'cancelled' },
      }),
    ]);
    return true;
  }
}
