import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { MyPayslipsController } from './my-payslips.controller';
import { KpiController } from './kpi.controller';
import { PayrollService } from './payroll.service';

@Module({
  controllers: [MyPayslipsController, KpiController, PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
