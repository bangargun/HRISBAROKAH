import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OutletsService } from './outlets.service';
import { CreateOutletDto, UpdateOutletDto } from './outlets.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('outlets')
export class OutletsController {
  constructor(private outletsService: OutletsService) {}

  @Get()
  async findAll(@Query('all') all?: string) {
    const onlyActive = all !== 'true';
    return this.outletsService.findAll(onlyActive);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.outletsService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post()
  async create(@Body() dto: CreateOutletDto) {
    return this.outletsService.create(dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER)
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateOutletDto) {
    return this.outletsService.update(id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.outletsService.remove(id);
  }
}
