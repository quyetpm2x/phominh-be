import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// JwtService dùng ở đây tới từ JwtModule đăng ký @Global trong app.module.ts (secret ADMIN_JWT_SECRET)
// — không đăng ký JwtModule riêng ở đây để tránh 2 secret khác nhau cho cùng 1 hệ thống token admin.
@Module({
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
