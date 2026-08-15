import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { SetLeadHandledDto } from './dto/set-lead-handled.dto';
import { PublicLeadsService } from './public-leads.service';

// Đọc/xử lý lead từ web marketing (tai-lieu-chuc-nang.md #75-83) — KHÁC hẳn
// public-leads.controller.ts (endpoint công khai, chỉ ghi): đây là phía admin, chỉ đọc/cập nhật
// trạng thái đã xử lý, luôn cần đăng nhập admin + quyền manage_marketing_leads.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('manage_marketing_leads')
@Controller('api/admin/marketing-leads')
export class MarketingLeadsAdminController {
  constructor(private readonly leads: PublicLeadsService) {}

  @Get()
  list(@Query('type') type?: string, @Query('handled') handled?: string) {
    const handledFilter = handled === undefined ? undefined : handled === 'true';
    return this.leads.listLeads(type, handledFilter);
  }

  @Patch(':id/handled')
  setHandled(@Param('id') id: string, @Body() dto: SetLeadHandledDto) {
    return this.leads.setHandled(id, dto.handled);
  }
}
