import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceAuthGuard } from './device-auth.guard';
import { BootstrapService } from './bootstrap.service';
import { KioskController } from './kiosk.controller';
import { EventsService } from './events.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AttendanceModule],
  controllers: [DevicesController, KioskController],
  providers: [DevicesService, DeviceAuthGuard, BootstrapService, EventsService],
  exports: [DevicesService, DeviceAuthGuard],
})
export class KioskModule {}
