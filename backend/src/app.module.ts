import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OutletsModule } from './modules/outlets/outlets.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { RequestsModule } from './modules/requests/requests.module';
import { FaceModule } from './modules/face/face.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { HolidaysModule } from './modules/holidays/holidays.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { SanctionsModule } from './modules/sanctions/sanctions.module';
import { ExitsModule } from './modules/exits/exits.module';
import { DailyReportsModule } from './modules/daily-reports/daily-reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    OutletsModule,
    EmployeesModule,
    AttendanceModule,
    RequestsModule,
    FaceModule,
    SchedulesModule,
    PayrollModule,
    HolidaysModule,
    DepartmentsModule,
    SanctionsModule,
    ExitsModule,
    DailyReportsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
