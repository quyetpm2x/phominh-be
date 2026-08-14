-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'banned', 'restricted');

-- AlterEnum (thêm giá trị mới vào enum có sẵn)
ALTER TYPE "DataDeletionStatus" ADD VALUE 'cancelled';

-- AlterTable: thay is_banned (boolean, không có lý do) bằng account_status có lý do + hạn hạn chế
ALTER TABLE "users" DROP COLUMN "is_banned";
ALTER TABLE "users" ADD COLUMN "account_status" "AccountStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "users" ADD COLUMN "status_reason" TEXT;
ALTER TABLE "users" ADD COLUMN "restricted_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "deletion_requested_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "terms_acceptances" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terms_acceptances_user_id_accepted_at_idx" ON "terms_acceptances"("user_id", "accepted_at");

-- AddForeignKey
ALTER TABLE "terms_acceptances" ADD CONSTRAINT "terms_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
