// Script dòng lệnh chạy 1 lần để tạo Owner đầu tiên — chỉ hoạt động khi bảng admin_users đang
// trống hoàn toàn (bussiness §9.9 "bootstrap problem"). Cũng seed sẵn danh mục permissions vì
// admin panel cần bảng này tồn tại trước khi Owner tạo admin thứ 2 trở đi.
//
// Chạy: pnpm create-owner --email=you@example.com --password=mat-khau-du-8-ky-tu --name="Chủ dự án"
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import {
  PERMISSION_KEYS,
  type PermissionKey,
} from '../src/common/decorators/require-permission.decorator';

const BCRYPT_ROUNDS = 12;

const PERMISSION_CATALOG: Record<PermissionKey, { label: string; groupName: string }> = {
  view_dashboard: { label: 'Xem Dashboard tổng quan', groupName: 'Tổng quan' },
  moderate_posts: { label: 'Xử lý report bài đăng', groupName: 'Kiểm duyệt' },
  moderate_comments_public: { label: 'Xử lý report bình luận công khai', groupName: 'Kiểm duyệt' },
  moderate_comments_private: { label: 'Xem bình luận riêng tư bị report', groupName: 'Kiểm duyệt' },
  moderate_comment_attacks: { label: 'Xử lý cụm tấn công tự động', groupName: 'Kiểm duyệt' },
  verify_emergency: { label: 'Xác minh tin khẩn cấp', groupName: 'Kiểm duyệt' },
  view_users: { label: 'Xem danh sách/chi tiết user', groupName: 'Người dùng' },
  view_collusion_flags: { label: 'Xem phát hiện thông đồng vote', groupName: 'Người dùng' },
  view_fraud_signals: { label: 'Xem tín hiệu gian lận', groupName: 'Người dùng' },
  manage_user_lock: { label: 'Khoá/mở khoá tài khoản', groupName: 'Người dùng' },
  manage_merchants: { label: 'Duyệt đăng ký merchant', groupName: 'Merchant' },
  manage_merchant_reports: {
    label: 'Xử lý report "nghi bán chuyên nghiệp"',
    groupName: 'Merchant',
  },
  monitor_merchant_phone: { label: 'Giám sát ẩn/hiện SĐT', groupName: 'Merchant' },
  seed_content: { label: 'Đăng bài mồi câu tương tác', groupName: 'Vận hành' },
  manage_pilot_areas: { label: 'Quản lý khu vực thí điểm', groupName: 'Vận hành' },
  manage_official_sources: { label: 'Cấu hình dữ liệu chính thống', groupName: 'Vận hành' },
  manage_legal_docs: { label: 'Quản lý điều khoản/chính sách', groupName: 'Pháp lý' },
  manage_data_deletion: { label: 'Xử lý yêu cầu xóa dữ liệu', groupName: 'Pháp lý' },
  view_sensitive_access_log: {
    label: 'Xem audit log truy cập dữ liệu nhạy cảm',
    groupName: 'Pháp lý',
  },
  view_analytics: { label: 'Xem thống kê nội dung/tăng trưởng/an toàn', groupName: 'Thống kê' },
  view_cost_analytics: { label: 'Xem chi phí vận hành', groupName: 'Thống kê' },
  manage_payment_disputes: { label: 'Xử lý hoàn tiền/tranh chấp', groupName: 'Thanh toán' },
  manage_payouts: { label: 'Duyệt/theo dõi lệnh chi hộ', groupName: 'Thanh toán' },
  manage_admins: { label: 'Tạo/sửa/xóa tài khoản admin khác', groupName: 'Quản trị hệ thống' },
};

function parseArgs(): { email: string; password: string; name: string } {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=');
      return [key, rest.join('=')];
    }),
  );
  if (!args.email || !args.password) {
    throw new Error(
      'Thiếu --email hoặc --password. VD: pnpm create-owner --email=a@b.com --password=xxxxxxxx',
    );
  }
  return { email: args.email, password: args.password, name: args.name ?? 'Owner' };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const existingCount = await prisma.adminUser.count();
    if (existingCount > 0) {
      throw new Error(
        'admin_users KHÔNG trống — script này chỉ chạy được cho Owner đầu tiên. Tạo admin tiếp theo qua giao diện web.',
      );
    }

    for (const key of PERMISSION_KEYS) {
      const meta = PERMISSION_CATALOG[key];
      await prisma.permission.upsert({
        where: { permissionKey: key },
        update: { label: meta.label, groupName: meta.groupName },
        create: { permissionKey: key, label: meta.label, groupName: meta.groupName },
      });
    }

    const { email, password, name } = parseArgs();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const owner = await prisma.adminUser.create({
      data: { email, passwordHash, name, isOwner: true },
    });

    console.warn(
      `Đã tạo Owner đầu tiên: ${owner.email} (id=${owner.id}). Đăng nhập tại POST /api/admin/auth/login.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
