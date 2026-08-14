import { randomBytes, createHash } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

import { PrismaService } from '../../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessTokenPayload {
  sub: string;
  phone: string;
}

// Ký/verify JWT user thường bằng jsonwebtoken trực tiếp (KHÔNG dùng JwtService/@nestjs/jwt) —
// JwtModule global trong app.module.ts đã bind sẵn ADMIN_JWT_SECRET cho admin panel, dùng lại sẽ
// lẫn 2 secret khác nhau vào cùng 1 token system. Cách này khớp với JwtAuthGuard đang verify bằng
// jsonwebtoken thẳng, không qua DI.
//
// Refresh token XOAY VÒNG (rotation): mỗi lần refresh, token cũ bị revoke ngay và cấp cặp mới —
// nếu 1 refresh token bị đánh cắp và dùng lại sau khi chủ sở hữu đã refresh trước đó, lần dùng lại
// sẽ thất bại vì token cũ đã revoked (tín hiệu để sau này cảnh báo/khoá tài khoản nếu cần).
@Injectable()
export class TokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokenPair(userId: string, phone: string): Promise<TokenPair> {
    const accessToken = this.signAccessToken(userId, phone);
    const refreshToken = await this.createRefreshToken(userId);
    return { accessToken, refreshToken };
  }

  // Verify + revoke token cũ + cấp cặp mới trong 1 bước — dùng cho POST /auth/refresh.
  async rotateRefreshToken(rawToken: string): Promise<TokenPair> {
    const tokenHash = this.hashRefreshToken(rawToken);
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!record) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(record.user.id, record.user.phoneNumber);
  }

  // Đăng xuất (tai-lieu-chuc-nang.md #72) — thu hồi ĐÚNG refresh token của thiết bị đang đăng xuất,
  // không đụng tới các thiết bị khác. Không lỗi nếu token không tìm thấy/đã revoke — đăng xuất phải
  // luôn "thành công" từ góc nhìn client dù token đã hết hiệu lực từ trước.
  async revokeToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Thu hồi TOÀN BỘ refresh token của 1 user — dùng khi khoá tài khoản (admin) hoặc yêu cầu xoá tài
  // khoản (tai-lieu-chuc-nang.md #69/#73), ép đăng xuất khỏi mọi thiết bị ngay lập tức.
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(userId: string, phone: string): string {
    const secret = this.config.getOrThrow<string>('USER_JWT_SECRET');
    // Number() bắt buộc: ConfigService.get<number>() không tự ép kiểu, trả về string thô từ env —
    // để nguyên string số thì jsonwebtoken hiểu sai đơn vị, token hết hạn gần như ngay lập tức.
    const expiresInSeconds = Number(this.config.get('USER_ACCESS_TOKEN_EXPIRES_IN_SECONDS', 1_800));
    const payload: AccessTokenPayload = { sub: userId, phone };
    return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresInDays = Number(this.config.get('USER_REFRESH_TOKEN_EXPIRES_IN_DAYS', 60));
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(rawToken),
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      },
    });
    return rawToken;
  }

  private hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
