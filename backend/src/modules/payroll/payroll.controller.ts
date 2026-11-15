import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PayrollService } from './payroll.service';
import { PayrollPeriodDto, UpdatePayrollSettingsDto } from './payroll.dto';

// Gaji bersifat rahasia: hanya HR, Keuangan dan Super Admin
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN)
@Controller('payroll')
export class PayrollController {
  constructor(private payrollService: PayrollService) {}

  @Get('settings')
  async getSettings() {
    return this.payrollService.getSettings();
  }

  @Put('settings')
  async updateSettings(@CurrentUser('id') userId: string, @Body() dto: UpdatePayrollSettingsDto) {
    return this.payrollService.updateSettings(userId, dto);
  }

  @Get()
  async list(@Query() dto: PayrollPeriodDto) {
    return this.payrollService.list(dto);
  }

  @Post('generate')
  async generate(@Body() dto: PayrollPeriodDto) {
    return this.payrollService.generate(dto);
  }

  @Post('finalize')
  async finalize(@CurrentUser('id') userId: string, @Body() dto: PayrollPeriodDto) {
    return this.payrollService.finalize(userId, dto);
  }

  // Menandai sudah ditransfer: urusan Keuangan
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  @Post('mark-paid')
  async markPaid(@Body() dto: PayrollPeriodDto) {
    return this.payrollService.markPaid(dto);
  }
}
