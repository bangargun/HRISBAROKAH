import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OutletsModule } from './modules/outlets/outlets.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { RequestsModule } from './modules/requests/requests.module';
import { FaceModule } from './modules/face/face.module';
import { ShiftsModule } from './modules/shifts/shifts.module';

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
    ShiftsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
