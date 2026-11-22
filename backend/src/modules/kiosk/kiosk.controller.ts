import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { CurrentDevice, DeviceAuthGuard, DeviceContext } from './device-auth.guard';
import { DevicesService } from './devices.service';
import { BootstrapService } from './bootstrap.service';
import { PairDeviceDto } from './kiosk.dto';

/** Rute tablet: tanpa JWT, memakai kode pairing / token perangkat. */
@Controller('kiosk')
export class KioskController {
  constructor(
    private devices: DevicesService,
    private bootstrapService: BootstrapService,
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
}
