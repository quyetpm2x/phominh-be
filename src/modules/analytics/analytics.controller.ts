import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { OwnerOnlyGuard } from '../../common/guards/owner-only.guard';

import { AnalyticsService } from './analytics.service';
import { CostEstimateService } from './cost-estimate.service';
import { SafetyReportService } from './safety-report.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('api/admin/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly safetyReportService: SafetyReportService,
    private readonly costEstimateService: CostEstimateService,
  ) {}

  @RequirePermission('view_analytics')
  @Get('daily-snapshot')
  getDailySnapshot(@Query('date') date: string, @Query('areaId') areaId?: string) {
    return this.analyticsService.getDailySnapshot(new Date(date), areaId);
  }

  // Sức khỏe theo khu vực G2-G4 (tai-lieu-chuc-nang.md #107) — bản mới nhất mỗi khu + toàn hệ thống.
  @RequirePermission('view_analytics')
  @Get('latest-snapshots')
  getLatestSnapshots() {
    return this.analyticsService.getLatestSnapshots();
  }

  // 4 số liệu cốt lõi cho Dashboard tổng quan (tai-lieu-chuc-nang.md #85).
  @RequirePermission('view_analytics')
  @Get('dashboard-summary')
  getDashboardSummary() {
    return this.analyticsService.getDashboardSummary();
  }

  // Chỉ số Bắc Đẩu G1 (tai-lieu-chuc-nang.md #106).
  @RequirePermission('view_analytics')
  @Get('north-star')
  getNorthStarMetric(@Query('days') days?: string) {
    return this.analyticsService.computeNorthStarMetric(days ? Number(days) : undefined);
  }

  // Báo cáo Merchant G6 (tai-lieu-chuc-nang.md #108).
  @RequirePermission('manage_merchant_reports')
  @Get('merchant-risk')
  getMerchantRisk() {
    return this.analyticsService.listMerchantRisk();
  }

  // Báo cáo An toàn G7 (tai-lieu-chuc-nang.md #109).
  @RequirePermission('view_analytics')
  @Get('safety-report')
  getSafetyReport() {
    return this.safetyReportService.getSafetyReport();
  }

  // Chi phí vận hành G8 (tai-lieu-chuc-nang.md #110) — CHỈ Owner xem được, không phải quyền có thể
  // cấp qua checkbox thông thường (OwnerOnlyGuard kiểm tra thẳng isOwner, không dùng @RequirePermission
  // — permission_key `view_cost_analytics` khai báo trong bussiness §9.9 nhưng cố tình KHÔNG dùng ở
  // đây, vì "chỉ Owner xem được" nghĩa là không cấp/thu hồi được cho admin thường qua UI phân quyền).
  @UseGuards(OwnerOnlyGuard)
  @Get('cost-estimate')
  getCostEstimate() {
    return this.costEstimateService.getCostEstimate();
  }
}
