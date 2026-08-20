import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { UserActivityService } from './user-activity.service';

// Thống kê hoạt động người dùng (bổ sung ngoài 117 mục gốc, thảo luận 2026-08-17), quyền dùng
// chung `view_analytics` với G1/dashboard-summary.
@ApiTags('user-activity')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('view_analytics')
@Controller('api/admin/user-activity')
export class UserActivityController {
  constructor(private readonly service: UserActivityService) {}

  @Get('overview')
  getOverview(@Query('dateFrom') dateFrom: string, @Query('dateTo') dateTo: string) {
    return this.service.getOverview(new Date(dateFrom), new Date(dateTo));
  }

  @Get(':userId')
  getUserActivity(
    @Param('userId') userId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    return this.service.getUserActivity(userId, new Date(dateFrom), new Date(dateTo));
  }
}
