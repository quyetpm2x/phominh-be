import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { LegalDocType, LegalDocument } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreateLegalDocumentDto } from './dto/create-legal-document.dto';

// Quản lý điều khoản/chính sách (tai-lieu-chuc-nang.md #103) — NGUỒN THẬT SỰ thay cho hằng số
// CURRENT_TERMS_VERSION cứng trước đây (account-lifecycle.service.ts). getCurrentVersion() được
// AccountLifecycleService.acceptTerms/getTermsStatus gọi trực tiếp — sửa ở đây ảnh hưởng THẬT tới
// luồng bắt buộc đồng ý điều khoản lúc onboarding (mục 67).
@Injectable()
export class LegalDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentVersion(docType: LegalDocType): Promise<string | null> {
    const current = await this.prisma.legalDocument.findFirst({
      where: { docType, isCurrent: true },
    });
    return current?.version ?? null;
  }

  async listVersions(docType: LegalDocType): Promise<LegalDocument[]> {
    return this.prisma.legalDocument.findMany({
      where: { docType },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Tạo bản NHÁP (isCurrent=false mặc định) — phải publish() riêng mới có hiệu lực, tránh 1 bản
  // soạn dở tự động trở thành điều khoản bắt buộc đồng ý.
  async createDraft(dto: CreateLegalDocumentDto): Promise<LegalDocument> {
    const existing = await this.prisma.legalDocument.findUnique({
      where: { docType_version: { docType: dto.docType, version: dto.version } },
    });
    if (existing) throw new ConflictException('Phiên bản này đã tồn tại cho loại văn bản này');

    return this.prisma.legalDocument.create({
      data: { docType: dto.docType, version: dto.version, content: dto.content },
    });
  }

  // Publish = version này isCurrent=true + MỌI version khác cùng docType tự động isCurrent=false
  // (transaction, không thể có 2 bản hiện hành cùng lúc cho 1 loại văn bản).
  async publish(id: string, adminId: string): Promise<LegalDocument> {
    const doc = await this.prisma.legalDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Không tìm thấy văn bản này');

    const [, published] = await this.prisma.$transaction([
      this.prisma.legalDocument.updateMany({
        where: { docType: doc.docType, isCurrent: true },
        data: { isCurrent: false },
      }),
      this.prisma.legalDocument.update({
        where: { id },
        data: { isCurrent: true, publishedByAdminId: adminId },
      }),
    ]);
    return published;
  }
}
