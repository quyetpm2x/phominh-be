import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { LeaderboardService } from './leaderboard.service';

// Xem bảng xếp hạng thưởng đã chốt theo tháng (tai-lieu-chuc-nang.md #116) — tái dùng thẳng
// LeaderboardService.getHistory() đã có sẵn cho mobile (mục 57, LeaderboardController), chỉ khác
// guard/quyền — dữ liệu CHÍNH THỨC (LeaderboardSnapshot) giống hệt nhau cho cả 2 phía. Dùng chung
// quyền manage_payouts (Nhóm I — Thanh toán) vì leaderboard quyết định trực tiếp rewardAmount, chưa
// có quyền riêng cho "xem xếp hạng". Chỉ XEM — không có hành động sửa số liệu/phát lại thưởng nào
// được mô tả trong tài liệu, nên không tự bịa thêm.
@ApiTags('rewards')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('manage_payouts')
@Controller('api/admin/leaderboard-snapshots')
export class AdminLeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  getHistory(@Query('tier', ParseIntPipe) tier: number, @Query('period') period?: string) {
    return this.leaderboard.getHistory(tier, period);
  }
}
