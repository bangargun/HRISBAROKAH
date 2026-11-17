import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InspectionsService } from './inspections.service';
import { InspectionResultDto, ScheduleInspectionDto } from './inspections.dto';

// Supervisor = Area Manager; HR dan Super Admin juga bisa. Kepala cabang hanya melihat hasil cabangnya.
const AUDITORS = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inspections')
export class InspectionsController {
  constructor(private service: InspectionsService) {}

  @Roles(...AUDITORS, UserRole.STORE_MANAGER)
  @Get('checklist')
  checklist() {
    return this.service.checklist();
  }

  @Roles(...AUDITORS, UserRole.STORE_MANAGER)
  @Get()
  list(@CurrentUser() user, @Query('outletId') outletId?: string) {
    return this.service.list(user, outletId);
  }

  @Roles(...AUDITORS)
  @Post()
  schedule(@CurrentUser() user, @Body() dto: ScheduleInspectionDto) {
    return this.service.schedule(user, dto);
  }

  @Roles(...AUDITORS)
  @Post(':id/result')
  record(@CurrentUser() user, @Param('id') id: string, @Body() dto: InspectionResultDto) {
    return this.service.record(user, id, dto);
  }

  @Roles(...AUDITORS)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
