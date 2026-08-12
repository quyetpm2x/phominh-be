import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ReportStatus } from '@prisma/client';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('api')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/reports')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto);
  }

  // B1/B2 — hàng đợi report (bussiness §9.2).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('moderate_posts')
  @Get('admin/reports')
  findQueue(@Query('status') status?: ReportStatus) {
    return this.reportsService.findQueue(status);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('moderate_posts')
  @Patch('admin/reports/:id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, admin.id, dto);
  }
}
