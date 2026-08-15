import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('api/admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @RequirePermission('view_analytics')
  @Get('daily-snapshot')
  getDailySnapshot(@Query('date') date: string, @Query('areaId') areaId?: string) {
    return this.analyticsService.getDailySnapshot(new Date(date), areaId);
  }

  // 4 số liệu cốt lõi cho Dashboard tổng quan (tai-lieu-chuc-nang.md #85).
  @RequirePermission('view_analytics')
  @Get('dashboard-summary')
  getDashboardSummary() {
    return this.analyticsService.getDashboardSummary();
  }
}
