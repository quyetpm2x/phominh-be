import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { AuditLogService } from './audit-log.service';

@ApiTags('audit')
@Controller('api/admin')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  // Log truy cập dữ liệu nhạy cảm (tai-lieu-chuc-nang.md #105) — lọc theo dataType nếu cần (VD
  // "private_comment" hoặc "user_detail").
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('view_sensitive_access_log')
  @Get('sensitive-access-log')
  list(@Query('dataType') dataType?: string) {
    return this.auditLog.list(dataType);
  }
}
