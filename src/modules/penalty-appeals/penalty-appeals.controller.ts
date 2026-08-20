import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { CreatePenaltyAppealDto } from './dto/create-penalty-appeal.dto';
import { PenaltyAppealsService } from './penalty-appeals.service';

// Khiếu nại phạt oan phía user (tai-lieu-chuc-nang.md #61).
@ApiTags('penalty-appeals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/penalty-appeals')
export class PenaltyAppealsController {
  constructor(private readonly service: PenaltyAppealsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePenaltyAppealDto) {
    return this.service.create(user.id, dto);
  }
}
