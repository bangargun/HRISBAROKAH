import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './holidays.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private holidaysService: HolidaysService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  async findYear(@Query('year') year: string) {
    return this.holidaysService.findYear(Number(year));
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post()
  async create(@Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
