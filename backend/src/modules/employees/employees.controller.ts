import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, ImportEmployeesDto, ResetPasswordDto, SetActiveDto, UpdateEmployeeDto } from './employees.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  // Data pribadi karyawan (NIK, alamat, rekening): bukan untuk akun kru
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  async findAll(
    @CurrentUser() user,
    @Query('outletId') outletId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.employeesService.findAll(user, outletId, departmentId);
  }

  // Harus sebelum ':id' agar tidak dianggap id karyawan
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get('positions')
  async listPositions() {
    return this.employeesService.listPositions();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get(':id')
  async findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.employeesService.findOne(user, id);
  }

  // Impor dari Excel: dryRun=true hanya memeriksa; false menyimpan bila semua baris benar
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('import')
  async importMany(@CurrentUser() user, @Body() dto: ImportEmployeesDto) {
    return this.employeesService.importMany(user, dto.rows, dto.dryRun);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post()
  async create(@CurrentUser() user, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user, dto);
  }

  // Sama dengan tambah karyawan: hanya Super Admin dan HR
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Put(':id')
  async update(@CurrentUser() user, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(user, id, dto);
  }

  // Karyawan lupa password: HR membuat password sementara; sesi lama karyawan itu keluar
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post(':id/reset-password')
  async resetPassword(@CurrentUser() user, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.employeesService.resetPassword(user, id, dto.newPassword);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Patch(':id/status')
  async setActive(@CurrentUser() user, @Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.employeesService.setActive(user, id, dto.isActive);
  }
}
