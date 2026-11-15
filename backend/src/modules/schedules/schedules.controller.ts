import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SchedulesService } from './schedules.service';
import { SaveSchedulesDto } from './schedules.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private schedulesService: SchedulesService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  async findRange(
    @CurrentUser() user,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.schedulesService.findRange(user, from, to, outletId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Put()
  async save(@CurrentUser() user, @Body() dto: SaveSchedulesDto) {
    return this.schedulesService.save(user, dto);
  }
}
