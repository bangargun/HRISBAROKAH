import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { CorrectionsController } from './corrections.controller';
import { CorrectionsService } from './corrections.service';

@Module({
  controllers: [AttendanceController, CorrectionsController],
  providers: [AttendanceService, CorrectionsService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
