-- CreateTable
CREATE TABLE "ignored_users" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ignored_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ignored_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ignored_users_user_id_ignored_user_id_key" ON "ignored_users"("user_id", "ignored_user_id");

-- AddForeignKey
ALTER TABLE "ignored_users" ADD CONSTRAINT "ignored_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ignored_users" ADD CONSTRAINT "ignored_users_ignored_user_id_fkey" FOREIGN KEY ("ignored_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
