// Script dev-only: tạo/nâng cấp 1 tài khoản THẬT trong DB đang trỏ ở DATABASE_URL, đủ điều kiện
// bình luận + vote ngay — dùng khi test tay, không phải luồng OTP thật (Tầng 2 task 11 / bussiness
// §4.1, §4.2a).
//
// Điều kiện code đang enforce — cùng 1 ngưỡng createdAt cho cả 2 hành động (comments.service.ts,
// votes.service.ts): tài khoản tồn tại >= 24h mới được bình luận/vote vào bài NGƯỜI KHÁC (bài của
// chính mình thì bình luận không cần chờ — post.authorId !== authorId mới bị chặn; đăng bài thì
// KHÔNG có rào cản tuổi tài khoản nào cả, đăng được ngay).
// (Điều kiện cũ "điểm uy tín thấp bị tự động ẩn bình luận" — bussiness §4.1 quy tắc 3 — đã bỏ,
// không còn cần set trustScore nữa.)
//
// Idempotent — chạy lại trên SĐT đã tồn tại chỉ cập nhật lại createdAt, không tạo trùng.
// Đây là ghi dữ liệu thật vào DATABASE_URL đang cấu hình — tự chạy, không nhờ AI chạy hộ (cùng
// nguyên tắc đã áp dụng cho docs/realtime-comments-setup.sql).
//
// Chạy: pnpm create-test-user --phone=0912345678 [--ageHours=24]
// Sau khi tạo: thêm "0912345678" vào TEST_PHONE_NUMBERS trong .env, đăng nhập bằng OTP cố định 000000.
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';

import { generateAliasCandidate } from '../src/common/utils/alias-generator';
import { normalizeVnPhoneNumber } from '../src/common/utils/phone.util';

const ALIAS_GENERATION_MAX_ATTEMPTS = 10;

function parseArgs(): { phone: string; ageHours: number } {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=');
      return [key, rest.join('=')];
    }),
  );
  if (!args.phone) {
    throw new Error('Thiếu --phone. VD: pnpm create-test-user --phone=0912345678');
  }
  return {
    phone: args.phone,
    ageHours: args.ageHours ? Number(args.ageHours) : 24,
  };
}

async function generateUniqueAlias(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < ALIAS_GENERATION_MAX_ATTEMPTS; attempt++) {
    const candidate = generateAliasCandidate();
    const taken = await prisma.user.findUnique({ where: { alias: candidate } });
    if (!taken) return candidate;
  }
  throw new Error('Không sinh được bí danh chưa trùng sau nhiều lần thử');
}

async function main(): Promise<void> {
  const { phone, ageHours } = parseArgs();
  const phoneNumber = normalizeVnPhoneNumber(phone);
  if (!phoneNumber) {
    throw new Error(`SĐT "${phone}" không hợp lệ (phải là số di động VN)`);
  }

  const prisma = new PrismaClient();
  try {
    const createdAt = new Date(Date.now() - ageHours * 60 * 60 * 1000);
    const existing = await prisma.user.findUnique({ where: { phoneNumber } });

    const user = existing
      ? await prisma.user.update({ where: { phoneNumber }, data: { createdAt } })
      : await prisma.user.create({
          data: { phoneNumber, alias: await generateUniqueAlias(prisma), createdAt },
        });

    console.warn(
      `${existing ? 'Đã cập nhật' : 'Đã tạo'} user test: ${user.phoneNumber} ` +
        `(alias=${user.alias}, tạo lúc=${user.createdAt.toISOString()}).\n` +
        `Còn 1 bước: thêm "${phone}" vào TEST_PHONE_NUMBERS trong .env rồi restart server, ` +
        `sau đó đăng nhập bằng OTP cố định 000000.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
