import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient — Service Role tương đương ở tầng DB (kết nối bằng DATABASE_URL qua
// Supavisor pooler, không phải anon key). Guard/permission check vẫn nằm ở NestJS layer, RLS trên
// Supabase giữ nguyên làm lớp phòng thủ dự phòng (tai-lieu-cong-nghe-backend.md §4.2).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
