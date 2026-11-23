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
import { Survey360Module } from './modules/survey360/survey360.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { KioskModule } from './modules/kiosk/kiosk.module';
import { AccessModule } from './modules/access/access.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { StripSecretsInterceptor } from './common/interceptors/strip-secrets.interceptor';

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
    Survey360Module,
    InspectionsModule,
    KioskModule,
    AccessModule,
  ],
  controllers: [],
  providers: [{ provide: APP_INTERCEPTOR, useClass: StripSecretsInterceptor }],
})
export class AppModule {}
