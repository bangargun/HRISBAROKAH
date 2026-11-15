import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto, UpdateShiftDto } from './shifts.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  async findAll(@CurrentUser() user, @Query('outletId') outletId?: string) {
    return this.shiftsService.findAll(user, outletId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER)
  @Post()
  async create(@Body() dto: CreateShiftDto) {
    return this.shiftsService.create(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.shiftsService.update(id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.shiftsService.remove(id);
  }
}
