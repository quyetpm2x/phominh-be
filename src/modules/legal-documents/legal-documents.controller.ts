import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { LegalDocType } from '@prisma/client';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { LegalDocumentsService } from './legal-documents.service';

// Quản lý điều khoản/chính sách (tai-lieu-chuc-nang.md #103, ScreenId F1).
@ApiTags('legal-documents')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('manage_legal_docs')
@Controller('api/admin/legal-documents')
export class LegalDocumentsController {
  constructor(private readonly service: LegalDocumentsService) {}

  @Get()
  list(@Query('docType') docType: LegalDocType) {
    return this.service.listVersions(docType);
  }

  @Post()
  createDraft(@Body() dto: CreateLegalDocumentDto) {
    return this.service.createDraft(dto);
  }

  @Patch(':id/publish')
  publish(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.service.publish(id, admin.id);
  }
}
