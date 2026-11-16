import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrectionsService } from './corrections.service';
import { CreateCorrectionDto, DecideCorrectionDto } from './corrections.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance-corrections')
export class CorrectionsController {
  constructor(private service: CorrectionsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  list(@CurrentUser() user, @Query('month') month?: string, @Query('outletId') outletId?: string) {
    return this.service.list(user, month, outletId);
  }

  // Kepala cabang mengajukan untuk krunya; HR bisa langsung mengajukan juga
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.STORE_MANAGER)
  @Post()
  create(@CurrentUser() user, @Body() dto: CreateCorrectionDto) {
    return this.service.create(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post(':id/decision')
  decide(@CurrentUser() user, @Param('id') id: string, @Body() dto: DecideCorrectionDto) {
    return this.service.decide(user, id, dto);
  }
}
