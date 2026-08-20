-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_collaborator" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "collaborator_kpi_targets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "posts_target" INTEGER NOT NULL DEFAULT 0,
    "votes_target" INTEGER NOT NULL DEFAULT 0,
    "comments_target" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborator_kpi_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collaborator_kpi_targets_user_id_key" ON "collaborator_kpi_targets"("user_id");

-- AddForeignKey
ALTER TABLE "collaborator_kpi_targets" ADD CONSTRAINT "collaborator_kpi_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
