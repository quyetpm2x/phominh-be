import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { LeaderboardService } from './leaderboard.service';

@ApiTags('rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/rewards/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  // Bảng SỐNG tháng đang chạy — 7 bảng RIÊNG BIỆT theo bậc, FE tự truyền tier của user (bussiness §5.1b).
  @Get()
  getLive(@Query('tier', ParseIntPipe) tier: number) {
    return this.leaderboard.getLiveLeaderboard(tier);
  }

  // Kết quả CHÍNH THỨC đã chốt — mặc định kỳ vừa kết thúc nếu không truyền period ("YYYY-MM").
  @Get('history')
  getHistory(@Query('tier', ParseIntPipe) tier: number, @Query('period') period?: string) {
    return this.leaderboard.getHistory(tier, period);
  }
}
