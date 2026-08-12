import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../guards/jwt-auth.guard';

// Dùng sau JwtAuthGuard: @CurrentUser() user: AuthenticatedUser trong tham số controller.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new Error('CurrentUser dùng ngoài route có JwtAuthGuard — request.user chưa được gắn');
    }
    return request.user;
  },
);
