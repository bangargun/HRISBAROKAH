import { Body, Controller, Get, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentDevice, DeviceAuthGuard, DeviceContext } from './device-auth.guard';
import { DevicesService } from './devices.service';
import { PairDeviceDto } from './kiosk.dto';

/** Rute tablet: tanpa JWT, memakai kode pairing / token perangkat. */
@Controller('kiosk')
export class KioskController {
  constructor(private devices: DevicesService) {}

  @Post('pair')
  pair(@Body() dto: PairDeviceDto, @Req() req, @Ip() ip: string) {
    // Di belakang Nginx, entri terakhir X-Forwarded-For adalah alamat asli klien
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').pop()?.trim();
    return this.devices.pair(dto.code, forwarded || ip);
  }

  // Sementara; diisi lengkap di Task 3
  @UseGuards(DeviceAuthGuard)
  @Get('bootstrap')
  bootstrap(@CurrentDevice() device: DeviceContext) {
    return { outletId: device.outletId };
  }
}
