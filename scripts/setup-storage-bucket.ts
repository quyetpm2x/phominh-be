// Script chạy 1 lần để tạo bucket Supabase Storage chứa ảnh bài đăng — idempotent (chạy lại không
// lỗi nếu bucket đã tồn tại). Chạy: pnpm setup-storage
//
// process.loadEnvFile() là API built-in của Node (từ v21.7/v22), không cần thêm package dotenv.
process.loadEnvFile();

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'post-images';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong .env');
  }

  const supabase = createClient(url, secretKey);

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  if (buckets.some((b) => b.name === BUCKET)) {
    console.warn(`Bucket "${BUCKET}" đã tồn tại, bỏ qua.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true, // ảnh bài đăng công khai, không cần signed URL
    fileSizeLimit: MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (createError) throw createError;

  console.warn(
    `Đã tạo bucket "${BUCKET}" (public, giới hạn ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB/file).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
