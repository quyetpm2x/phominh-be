import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string; // = Supabase auth.users.id, dùng trực tiếp làm User.id (prisma/schema.prisma)
  phone?: string;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

interface UserJwtPayload {
  sub: string;
  phone: string;
  exp?: number;
}

// Tự verify chữ ký JWT do chính NestJS phát hành sau khi OtpService.verifyOtp xác nhận đúng mã
// (modules/auth/token.service.ts) — KHÔNG còn dùng Supabase Auth cho user thường (đổi kiến trúc từ
// tai-lieu-cong-nghe-backend.md §4.1, xem ghi chú tại schema.prisma model User). Dùng jsonwebtoken
// trực tiếp thay vì JwtService để không lẫn với JwtModule global đang bind ADMIN_JWT_SECRET
// (app.module.ts) — 2 hệ thống token hoàn toàn tách biệt theo đúng nguyên tắc admin/user riêng.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Thiếu token xác thực');
    }

    const secret = this.config.getOrThrow<string>('USER_JWT_SECRET');
    try {
      const payload = jwt.verify(token, secret) as UserJwtPayload;
      request.user = { id: payload.sub, phone: payload.phone };
      return true;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
  }
}
