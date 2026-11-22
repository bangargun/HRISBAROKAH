import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { CurrentDevice, DeviceAuthGuard, DeviceContext } from './device-auth.guard';
import { DevicesService } from './devices.service';
import { BootstrapService } from './bootstrap.service';
import { IdentifyDto, KioskEventsDto, PairDeviceDto } from './kiosk.dto';
import { EventsService } from './events.service';

/** Rute tablet: tanpa JWT, memakai kode pairing / token perangkat. */
@Controller('kiosk')
export class KioskController {
  constructor(
    private devices: DevicesService,
    private bootstrapService: BootstrapService,
    private eventsService: EventsService,
  ) {}

  @Post('pair')
  pair(@Body() dto: PairDeviceDto, @Ip() ip: string) {
    // `trust proxy` (main.ts) membuat req.ip jadi alamat klien asli di belakang Nginx
    return this.devices.pair(dto.code, ip);
  }

  @UseGuards(DeviceAuthGuard)
  @Get('bootstrap')
  bootstrap(@CurrentDevice() device: DeviceContext) {
    return this.bootstrapService.build(device.outletId);
  }

  /** Batas body rute ini diatur di main.ts (KIOSK_EVENTS_BODY_LIMIT). */
  @UseGuards(DeviceAuthGuard)
  @Post('events')
  events(@CurrentDevice() device: DeviceContext, @Body() dto: KioskEventsDto) {
    return this.eventsService.ingest(device, dto);
  }

  @UseGuards(DeviceAuthGuard)
  @Post('identify')
  identify(@CurrentDevice() device: DeviceContext, @Body() dto: IdentifyDto) {
    return this.eventsService.identify(device, dto.photoBase64);
  }
}
