import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { MyPayslipsController } from './my-payslips.controller';
import { PayrollService } from './payroll.service';

@Module({
  controllers: [MyPayslipsController, PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
