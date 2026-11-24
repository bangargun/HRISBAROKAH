import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceAuthGuard } from './device-auth.guard';
import { BootstrapService } from './bootstrap.service';
import { KioskController } from './kiosk.controller';
import { EventsService } from './events.service';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { RequestsModule } from '../requests/requests.module';
import { KioskRequestsService } from './requests.service';

@Module({
  imports: [AttendanceModule, RequestsModule],
  controllers: [DevicesController, KioskController, ReviewController],
  providers: [DevicesService, DeviceAuthGuard, BootstrapService, EventsService, ReviewService, KioskRequestsService],
  exports: [DevicesService, DeviceAuthGuard],
})
export class KioskModule {}
