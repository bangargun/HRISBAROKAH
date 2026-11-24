import { Body, Controller, Get, Ip, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentDevice, DeviceAuthGuard, DeviceContext } from './device-auth.guard';
import { DevicesService } from './devices.service';
import { BootstrapService } from './bootstrap.service';
import { IdentifyDto, KioskEventsDto, KioskRequestDto, PairDeviceDto } from './kiosk.dto';
import { KioskRequestsService } from './requests.service';
import { EventsService } from './events.service';

/** Rute tablet: tanpa JWT, memakai kode pairing / token perangkat. */
@Controller('kiosk')
export class KioskController {
  constructor(
    private devices: DevicesService,
    private bootstrapService: BootstrapService,
    private eventsService: EventsService,
    private requestsService: KioskRequestsService,
  ) {}

  @Post('pair')
  pair(@Body() dto: PairDeviceDto, @Ip() ip: string) {
    // `trust proxy` (main.ts) membuat req.ip jadi alamat klien asli di belakang Nginx
    return this.devices.pair(dto.code, ip);
  }

  /**
   * `pending` = jumlah absen yang belum terkirim di tablet (dilaporkan tablet). Disimpan pada
   * perangkat agar admin tahu apa yang hilang bila tablet dicabut. Nilai tidak sah diabaikan.
   */
  @UseGuards(DeviceAuthGuard)
  @Get('bootstrap')
  async bootstrap(@CurrentDevice() device: DeviceContext, @Query('pending') pending?: string) {
    if (pending !== undefined && /^\d{1,6}$/.test(pending)) {
      await this.devices.reportPending(device.deviceId, Number(pending));
    }
    return this.bootstrapService.build(device.outletId);
  }

  /** Jam server, ringan: tablet mengukur selisih jamnya tepat sebelum mengirim batch event. */
  @UseGuards(DeviceAuthGuard)
  @Get('time')
  time() {
    return { serverTime: new Date().toISOString() };
  }

  /** Batas body rute ini diatur di main.ts (KIOSK_EVENTS_BODY_LIMIT). */
  @UseGuards(DeviceAuthGuard)
  @Post('events')
  events(@CurrentDevice() device: DeviceContext, @Body() dto: KioskEventsDto) {
    return this.eventsService.ingest(device, dto);
  }

  @UseGuards(DeviceAuthGuard)
  @Post('identify')
  async identify(@CurrentDevice() device: DeviceContext, @Body() dto: IdentifyDto) {
    const match = await this.eventsService.identify(device, dto.photoBase64);
    // Kru tak terduga (di luar roster tablet): sertakan absen hari ini / yang masih terbuka di
    // cabang mana pun, agar tablet menawarkan Istirahat / Pulang, bukan Masuk
    const today = await this.bootstrapService.todayRows(device.outletId, [match.employeeId], { includeOutlet: false });
    return { ...match, today };
  }

  /** Pengajuan cuti / izin / sakit dari tablet (butuh internet; tidak diantrekan seperti absen). */
  @UseGuards(DeviceAuthGuard)
  @Post('requests')
  createRequest(@CurrentDevice() device: DeviceContext, @Body() dto: KioskRequestDto) {
    return this.requestsService.create(device, dto);
  }
}
