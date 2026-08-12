import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  isOwner: boolean;
}

declare module 'express' {
  interface Request {
    admin?: AuthenticatedAdmin;
  }
}

// Xác thực admin panel — HOÀN TOÀN riêng biệt với JwtAuthGuard (Supabase OTP của user thường),
// đúng bussiness §9.1 A1. Token tự phát hành ở modules/admin (login bằng email+password+bcrypt).
@Injectable()
export class AdminJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu token admin');
    }

    try {
      const payload = this.jwtService.verify<AuthenticatedAdmin>(header.slice('Bearer '.length));
      request.admin = { id: payload.id, email: payload.email, isOwner: payload.isOwner };
      return true;
    } catch {
      throw new UnauthorizedException('Token admin không hợp lệ hoặc đã hết hạn');
    }
  }
}
