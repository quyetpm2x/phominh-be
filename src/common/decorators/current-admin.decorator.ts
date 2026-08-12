import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedAdmin } from '../guards/admin-jwt-auth.guard';

// Dùng sau AdminJwtAuthGuard: @CurrentAdmin() admin: AuthenticatedAdmin. Tách riêng khỏi
// @CurrentUser() vì request.user (Supabase) và request.admin (JWT tự phát hành) là 2 hệ xác thực
// hoàn toàn độc lập (bussiness §9.1 A1).
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.admin) {
      throw new Error(
        'CurrentAdmin dùng ngoài route có AdminJwtAuthGuard — request.admin chưa được gắn',
      );
    }
    return request.admin;
  },
);
