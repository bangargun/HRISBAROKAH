import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExitsService } from './exits.service';
import { CreateExitDto, UpdateExitDto } from './exits.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employee-exits')
export class ExitsController {
  constructor(private service: ExitsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  list(@CurrentUser() user, @Query('outletId') outletId?: string) {
    return this.service.list(user, outletId);
  }

  // Kepala cabang mencatat pengunduran diri krunya; PHK hanya HR (dicek di service)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.STORE_MANAGER)
  @Post()
  create(@CurrentUser() user, @Body() dto: CreateExitDto) {
    return this.service.create(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.STORE_MANAGER)
  @Patch(':id')
  update(@CurrentUser() user, @Param('id') id: string, @Body() dto: UpdateExitDto) {
    return this.service.update(user, id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post(':id/complete')
  complete(@CurrentUser() user, @Param('id') id: string) {
    return this.service.complete(user, id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post(':id/cancel')
  cancel(@CurrentUser() user, @Param('id') id: string) {
    return this.service.cancel(user, id);
  }
}
