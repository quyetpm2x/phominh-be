-- AlterTable
ALTER TABLE "user_bank_accounts" ADD COLUMN "account_number_hash" TEXT;

-- CreateIndex
CREATE INDEX "user_bank_accounts_account_number_hash_idx" ON "user_bank_accounts"("account_number_hash");
