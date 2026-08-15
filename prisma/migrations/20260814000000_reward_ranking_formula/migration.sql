-- Opt-in kiếm tiền (bussiness §5.1a)
ALTER TABLE "users" ADD COLUMN "earn_via_posts_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "affiliate_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "earn_enabled_at" TIMESTAMP(3);

-- Mức độ vi phạm — dùng chung cho hệ số không vi phạm trong công thức xếp hạng thưởng
CREATE TYPE "ViolationSeverity" AS ENUM ('light', 'medium', 'severe');
ALTER TABLE "trust_score_history" ADD COLUMN "severity" "ViolationSeverity";

-- reward_ledger.amount đổi ý nghĩa sang ĐỒNG (VND) trực tiếp — không đổi kiểu cột, chỉ đổi comment
-- ở schema.prisma, không cần câu lệnh SQL riêng.

-- Ví thưởng (denormalized balance)
CREATE TABLE "reward_wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reward_wallets_user_id_key" ON "reward_wallets"("user_id");
ALTER TABLE "reward_wallets" ADD CONSTRAINT "reward_wallets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Khoá bậc đầu tháng (Phương án B)
CREATE TABLE "monthly_tier_snapshots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "tier_at_month_start" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_tier_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "monthly_tier_snapshots_user_id_period_key" ON "monthly_tier_snapshots"("user_id", "period");
ALTER TABLE "monthly_tier_snapshots" ADD CONSTRAINT "monthly_tier_snapshots_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Kết quả bảng xếp hạng chính thức theo kỳ × bậc
CREATE TABLE "leaderboard_snapshots" (
    "id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "reward_amount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leaderboard_snapshots_period_tier_user_id_key" ON "leaderboard_snapshots"("period", "tier", "user_id");
CREATE INDEX "leaderboard_snapshots_period_tier_rank_idx" ON "leaderboard_snapshots"("period", "tier", "rank");
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
