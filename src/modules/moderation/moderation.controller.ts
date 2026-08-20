import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { ModerationService } from './moderation.service';

// Scaffold — xem ghi chú trong moderation.service.ts. Route đăng ký trước để đúng cấu trúc §5,
// chưa có logic thật đứng sau.
@ApiTags('moderation')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@Controller('api/admin/moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('collusion/scan')
  @RequirePermission('view_collusion_flags')
  scanCollusion() {
    return this.moderationService.detectVoteCollusion();
  }

  // Tín hiệu gian lận tổng hợp (tai-lieu-chuc-nang.md #94) — xem giải thích phạm vi thật trong
  // ModerationService.getFraudSignals().
  @Get('fraud-signals')
  @RequirePermission('view_fraud_signals')
  getFraudSignals() {
    return this.moderationService.getFraudSignals();
  }
}
