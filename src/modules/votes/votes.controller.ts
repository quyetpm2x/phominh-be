import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { CastVoteDto } from './dto/cast-vote.dto';
import { VotesService } from './votes.service';

@ApiTags('votes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/votes')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Post()
  cast(@CurrentUser() user: AuthenticatedUser, @Body() dto: CastVoteDto) {
    return this.votesService.castVote(user.id, dto);
  }
}
