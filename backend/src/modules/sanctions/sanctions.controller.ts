import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SanctionsService } from './sanctions.service';
import { CreateSanctionDto } from './sanctions.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sanctions')
export class SanctionsController {
  constructor(private service: SanctionsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  list(@CurrentUser() user, @Query('outletId') outletId?: string, @Query('employeeId') employeeId?: string) {
    return this.service.list(user, outletId, employeeId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post()
  create(@CurrentUser() user, @Body() dto: CreateSanctionDto) {
    return this.service.create(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
