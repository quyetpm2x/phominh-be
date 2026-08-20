-- CreateEnum
CREATE TYPE "LegalDocType" AS ENUM ('terms', 'privacy');

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL,
    "doc_type" "LegalDocType" NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "published_by_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_doc_type_version_key" ON "legal_documents"("doc_type", "version");

-- CreateIndex
CREATE INDEX "legal_documents_doc_type_is_current_idx" ON "legal_documents"("doc_type", "is_current");

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_published_by_admin_id_fkey" FOREIGN KEY ("published_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed bản "terms" hiện hành khớp đúng hằng số CURRENT_TERMS_VERSION cũ ('2026-01') — giữ hành vi
-- không đổi cho user đã accept trước đây (TermsAcceptance.version='2026-01' vẫn khớp). Nội dung đầy
-- đủ vẫn quản lý tĩnh phía mobile app/settings/terms.tsx (ngoài phạm vi mục 103) — content ở đây là
-- placeholder admin có thể sửa ngay qua màn quản lý mới.
INSERT INTO "legal_documents" ("id", "doc_type", "version", "content", "is_current", "created_at")
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'terms',
    '2026-01',
    'Nội dung điều khoản sử dụng đầy đủ hiện hiển thị tĩnh trong app di động — cập nhật bản ghi này khi có phiên bản mới.',
    true,
    CURRENT_TIMESTAMP
);
