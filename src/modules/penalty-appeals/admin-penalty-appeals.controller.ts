import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AppealStatus } from '@prisma/client';

import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import {
  AdminJwtAuthGuard,
  type AuthenticatedAdmin,
} from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { ReviewPenaltyAppealDto } from './dto/review-penalty-appeal.dto';
import { PenaltyAppealsService } from './penalty-appeals.service';

// Xử lý khiếu nại phạt oan phía admin (tai-lieu-chuc-nang.md #96, ScreenId C6) — dùng chung quyền
// manage_user_lock vì cùng nhóm hành động ảnh hưởng trực tiếp tới điểm/tình trạng tài khoản user
// (giống C5 khóa/mở khóa), chưa có permission riêng cho khiếu nại.
@ApiTags('penalty-appeals')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('manage_user_lock')
@Controller('api/admin/penalty-appeals')
export class AdminPenaltyAppealsController {
  constructor(private readonly service: PenaltyAppealsService) {}

  @Get()
  list(@Query('status') status?: AppealStatus) {
    return this.service.listForAdmin(status);
  }

  @Patch(':id/review')
  review(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body() dto: ReviewPenaltyAppealDto,
  ) {
    return this.service.review(id, admin.id, dto.decision);
  }
}
