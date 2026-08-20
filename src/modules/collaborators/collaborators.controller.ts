import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { CollaboratorsService } from './collaborators.service';
import { MarkCollaboratorDto } from './dto/mark-collaborator.dto';
import { SetKpiTargetDto } from './dto/set-kpi-target.dto';

// Quản lý cộng tác viên (ngoài phạm vi tài liệu chức năng gốc — bổ sung theo yêu cầu vận hành).
// Dùng chung quyền `seed_content` với mục 100 — cùng nhóm công cụ vận hành cộng đồng/cold-start.
@ApiTags('collaborators')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('seed_content')
@Controller('api/admin/collaborators')
export class CollaboratorsController {
  constructor(private readonly service: CollaboratorsService) {}

  @Get()
  list(@Query('dateFrom') dateFrom: string, @Query('dateTo') dateTo: string) {
    return this.service.listWithStats(new Date(dateFrom), new Date(dateTo));
  }

  @Post()
  mark(@Body() dto: MarkCollaboratorDto) {
    return this.service.mark(dto.userId);
  }

  @Delete(':userId')
  unmark(@Param('userId') userId: string) {
    return this.service.unmark(userId);
  }

  @Patch(':userId/kpi-target')
  setKpiTarget(@Param('userId') userId: string, @Body() dto: SetKpiTargetDto) {
    return this.service.setKpiTarget(userId, dto);
  }
}
