import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

// @Global — mọi module dùng Prisma trực tiếp qua constructor injection, không cần import lại
// PrismaModule ở từng modules/* (giảm boilerplate cho 14 module domain).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
