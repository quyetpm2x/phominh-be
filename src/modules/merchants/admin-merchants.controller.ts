import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { AdminPhoneVisibilityMonitorService } from './admin-phone-visibility-monitor.service';
import { MerchantsService } from './merchants.service';

// Tách khỏi MerchantsController (class đó có @UseGuards(JwtAuthGuard) ở mức controller cho toàn bộ
// route mobile tự-phục vụ — không dùng chung được với route admin cần AdminJwtAuthGuard khác hẳn).
@ApiTags('merchants')
@Controller('api/admin/merchants')
export class AdminMerchantsController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly phoneVisibilityMonitor: AdminPhoneVisibilityMonitorService,
  ) {}

  // Danh sách merchant cho admin giám sát (tai-lieu-chuc-nang.md #97).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('manage_merchants')
  @Get()
  list(@Query('query') query?: string) {
    return this.merchantsService.listForAdmin(query);
  }

  // Giám sát ẩn/hiện SĐT theo giờ (tai-lieu-chuc-nang.md #99).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('monitor_merchant_phone')
  @Get('phone-visibility-monitor')
  listPhoneVisibilityMonitor() {
    return this.phoneVisibilityMonitor.list();
  }
}
