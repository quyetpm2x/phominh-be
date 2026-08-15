import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { EmergencyService } from './emergency.service';

// B5 (tai-lieu-chuc-nang.md #90) — can thiệp thủ công + đánh dấu "đã giải quyết", tách khỏi
// EmergencyController (phía user, xác nhận đa nguồn) vì khác hẳn về đối tượng gọi/guard.
@ApiTags('emergency')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('verify_emergency')
@Controller('api/admin/emergency')
export class EmergencyAdminController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Get()
  list() {
    return this.emergencyService.listForAdmin();
  }

  @Patch(':postId/verify')
  verify(@Param('postId') postId: string) {
    return this.emergencyService.verifyManually(postId);
  }

  @Patch(':postId/resolve')
  resolve(@Param('postId') postId: string) {
    return this.emergencyService.resolve(postId);
  }
}
