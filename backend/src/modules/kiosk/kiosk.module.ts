import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceAuthGuard } from './device-auth.guard';
import { KioskController } from './kiosk.controller';

@Module({
  controllers: [DevicesController, KioskController],
  providers: [DevicesService, DeviceAuthGuard],
  exports: [DevicesService, DeviceAuthGuard],
})
export class KioskModule {}
