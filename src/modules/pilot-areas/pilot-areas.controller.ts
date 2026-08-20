import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AdminJwtAuthGuard } from '../../common/guards/admin-jwt-auth.guard';
import { AdminPermissionGuard } from '../../common/guards/admin-permission.guard';

import { CreatePilotAreaDto } from './dto/create-pilot-area.dto';
import { SetPilotAreaActiveDto } from './dto/set-pilot-area-active.dto';
import { PilotAreasService } from './pilot-areas.service';

// Quản lý khu vực thí điểm (tai-lieu-chuc-nang.md #101) — thuần admin, không có route mobile nào.
@ApiTags('pilot-areas')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminPermissionGuard)
@RequirePermission('manage_pilot_areas')
@Controller('api/admin/pilot-areas')
export class PilotAreasController {
  constructor(private readonly pilotAreas: PilotAreasService) {}

  @Get()
  list() {
    return this.pilotAreas.listWithStats();
  }

  @Post()
  create(@Body() dto: CreatePilotAreaDto) {
    return this.pilotAreas.create(dto);
  }

  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body() dto: SetPilotAreaActiveDto) {
    return this.pilotAreas.setActive(id, dto.isActive);
  }
}
