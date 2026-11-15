import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OutletsService } from './outlets.service';
import { CreateOutletDto, UpdateOutletDto } from './outlets.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('outlets')
export class OutletsController {
  constructor(private outletsService: OutletsService) {}

  // Data cabang (termasuk daftar karyawan di detail) hanya untuk admin & manajer
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  async findAll(@CurrentUser() user, @Query('all') all?: string) {
    return this.outletsService.findAll(user, all !== 'true');
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get(':id')
  async findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.outletsService.findOne(user, id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post()
  async create(@Body() dto: CreateOutletDto) {
    return this.outletsService.create(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER)
  @Put(':id')
  async update(@CurrentUser() user, @Param('id') id: string, @Body() dto: UpdateOutletDto) {
    return this.outletsService.update(user, id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.outletsService.remove(id);
  }
}
