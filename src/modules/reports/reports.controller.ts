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
import { RevealPrivateCommentDto } from './dto/reveal-private-comment.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportQueriesService } from './report-queries.service';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('api')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportQueries: ReportQueriesService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('mobile/reports')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto);
  }

  // B1 (tai-lieu-chuc-nang.md #86).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('moderate_posts')
  @Get('admin/reports/posts')
  findPostReports(@Query('status') status?: ReportStatus) {
    return this.reportQueries.findPostReports(status);
  }

  // B2 (tai-lieu-chuc-nang.md #87).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('moderate_comments_public')
  @Get('admin/reports/comments-public')
  findPublicCommentReports(@Query('status') status?: ReportStatus) {
    return this.reportQueries.findPublicCommentReports(status);
  }

  // B3 (tai-lieu-chuc-nang.md #88) — content bị redact, xem reveal-private-comment bên dưới.
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('moderate_comments_private')
  @Get('admin/reports/comments-private')
  findPrivateCommentReports(@Query('status') status?: ReportStatus) {
    return this.reportQueries.findPrivateCommentReports(status);
  }

  // Bắt buộc ghi lý do trước khi xem nội dung — ghi SensitiveDataAccessLog (bussiness §9.9).
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
  @RequirePermission('moderate_comments_private')
  @Post('admin/reports/:id/reveal-private-comment')
  revealPrivateComment(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: RevealPrivateCommentDto,
  ) {
    return this.reportsService.revealPrivateComment(id, admin.id, dto.reason);
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
