import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { ConfirmEmergencyDto } from './dto/confirm-emergency.dto';
import { EmergencyService } from './emergency.service';

@ApiTags('emergency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/posts/:postId/emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post('confirm')
  confirm(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmEmergencyDto,
  ) {
    return this.emergencyService.confirm(postId, user.id, dto);
  }

  @Get('status')
  status(@Param('postId') postId: string) {
    return this.emergencyService.getStatus(postId);
  }
}
