import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Bọc Secret Key (sb_secret_..., bản thay thế Service Role Key kiểu JWT cũ) — "chìa khóa vạn
// năng", chỉ dùng ở backend, KHÔNG BAO GIỜ log/commit (tai-lieu-cong-nghe-backend.md §4.2). Hiện
// tại chỉ dùng cho việc Nest xác minh/khởi tạo phía Supabase khi cần (vd kiểm tra user tồn tại
// trong auth.users) — mọi thao tác ghi dữ liệu nghiệp vụ vẫn đi qua Prisma, không qua client này,
// giữ đúng ranh giới §6.
@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SECRET_KEY'),
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }
}
