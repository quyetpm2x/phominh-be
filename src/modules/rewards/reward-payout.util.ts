// Mức thưởng, ngưỡng rút tiền & thuế (bussiness §5.1c/e) — hàm THUẦN TÚY, không import Prisma.

// Kích hoạt trả thưởng thật (leaderboard §5.1c VÀ affiliate §5.1d dùng CHUNG mốc này) — trước mốc
// này mã giới thiệu/leaderboard vẫn hoạt động nhưng không tích luỹ thưởng.
const ACTIVATION_USER_THRESHOLD = 100;

export function isRewardsActivated(activeUserCount: number): boolean {
  return activeUserCount >= ACTIVATION_USER_THRESHOLD;
}

// Hệ số nhân theo bậc 0-6 (bussiness §5.1c) — cùng thứ tự TIER_LABELS ở trust-score.service.ts.
export const TIER_MULTIPLIER = [1.0, 1.3, 1.6, 2.0, 2.5, 3.2, 4.0] as const;
const BASE_TOP1_REWARD = 300_000; // đồng

// Đường cong % hạng 1-10 trong 1 bậc, tổng = 100% ngân sách bậc đó (bussiness §5.1b) — hạng 1 (25%)
// khớp đúng topRewardForTier vì ngân sách = topReward ÷ 25%.
const RANK_CURVE_PERCENT = [25, 16, 12, 9, 8, 7, 6, 6, 6, 5] as const;

export function topRewardForTier(tier: number): number {
  const clampedTier = Math.min(Math.max(tier, 0), TIER_MULTIPLIER.length - 1);
  return BASE_TOP1_REWARD * TIER_MULTIPLIER[clampedTier];
}

// rank ngoài 1-10 (bậc có ít hơn 10 user hoạt động) → 0đ, KHÔNG hạ tiêu chuẩn lấp đủ 10 (bussiness §5.1b).
export function rewardForRank(tier: number, rank: number): number {
  if (rank < 1 || rank > RANK_CURVE_PERCENT.length) return 0;
  const budget = topRewardForTier(tier) / (RANK_CURVE_PERCENT[0] / 100);
  return Math.round(budget * (RANK_CURVE_PERCENT[rank - 1] / 100));
}

// Affiliate — ĐÃ CHỐT 5.000đ/lượt cố định (bussiness §5.1d).
export const REFERRAL_REWARD_AMOUNT = 5_000;
// "Đề xuất 10-20 lượt/tháng" — bussiness §5.1d CHƯA chốt số chính xác trong khoảng này, chọn tạm
// điểm giữa; cần xác nhận lại với sản phẩm khi có traction thật.
export const REFERRAL_MONTHLY_CAP = 15;

// Rút thưởng (bussiness §5.1e).
const MIN_PAYOUT_AMOUNT = 50_000;
const PAYOUT_MULTIPLE = 50_000;
const ADMIN_REVIEW_THRESHOLD = 2_000_000;
const BANK_LINK_COOLDOWN_HOURS = 72; // khoảng "48-72h" trong tài liệu — chọn cận trên, an toàn hơn.
// Nghị định 253/2026 (thông tin sơ bộ, CẦN LUẬT SƯ XÁC NHẬN theo đúng cảnh báo trong tài liệu) —
// ngưỡng khấu trừ TNCN 10% cho phần thưởng vượt mức.
const TAX_WITHHOLDING_THRESHOLD = 20_000_000;
const TAX_WITHHOLDING_RATE = 0.1;

export function isBankLinkCooldownPassed(linkedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - linkedAt.getTime() >= BANK_LINK_COOLDOWN_HOURS * 60 * 60 * 1000;
}

export function isValidPayoutAmount(amount: number, walletBalance: number): boolean {
  return amount >= MIN_PAYOUT_AMOUNT && amount % PAYOUT_MULTIPLE === 0 && amount <= walletBalance;
}

// UI cho user CHỌN 1 trong các mốc khả dụng, không nhập số tuỳ ý (bussiness §5.1e).
export function availablePayoutAmounts(walletBalance: number): number[] {
  const maxMultiple = Math.floor(walletBalance / PAYOUT_MULTIPLE);
  const amounts: number[] = [];
  for (let i = 1; i <= maxMultiple; i++) amounts.push(i * PAYOUT_MULTIPLE);
  return amounts;
}

export function requiresManualAdminApproval(
  amount: number,
  isFirstPayoutForUser: boolean,
): boolean {
  return isFirstPayoutForUser || amount >= ADMIN_REVIEW_THRESHOLD;
}

export function taxWithheld(grossAmount: number): number {
  if (grossAmount <= TAX_WITHHOLDING_THRESHOLD) return 0;
  return Math.round(grossAmount * TAX_WITHHOLDING_RATE);
}

export function netPayoutAmount(grossAmount: number): number {
  return grossAmount - taxWithheld(grossAmount);
}
