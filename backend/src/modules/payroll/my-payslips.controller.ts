import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PayrollService } from './payroll.service';

/** Slip gaji milik karyawan yang login (aplikasi HP). Hanya gaji yang sudah difinalkan. */
@UseGuards(JwtAuthGuard)
@Controller('payroll/my')
export class MyPayslipsController {
  constructor(private payrollService: PayrollService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.payrollService.myPayslips(userId);
  }
}
