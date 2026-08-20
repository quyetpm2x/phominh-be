import { SetMetadata } from '@nestjs/common';

// Danh sách permission_key hợp lệ — khớp cột permissions.permission_key (bussiness §9.9), seed ở
// scripts/create-owner.ts. Giữ dạng union string thay vì enum để dễ đối chiếu 1-1 với hàng trong DB.
export const PERMISSION_KEYS = [
  'view_dashboard',
  'moderate_posts',
  'moderate_comments_public',
  'moderate_comments_private',
  'moderate_comment_attacks',
  'verify_emergency',
  'view_users',
  'view_posts',
  'view_collusion_flags',
  'view_fraud_signals',
  'manage_user_lock',
  'manage_merchants',
  'manage_merchant_reports',
  'monitor_merchant_phone',
  'seed_content',
  'manage_pilot_areas',
  'manage_official_sources',
  'manage_legal_docs',
  'manage_data_deletion',
  'view_sensitive_access_log',
  'view_analytics',
  'view_cost_analytics',
  'manage_payment_disputes',
  'manage_payouts',
  'manage_admins',
  'manage_marketing_leads',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const REQUIRE_PERMISSION_KEY = 'require_permission';
export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
