import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { CreatePairingDto } from './kiosk.dto';

/** Kelola tablet absensi per cabang (admin). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('outlets/:id/devices')
export class DevicesController {
  constructor(private devices: DevicesService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post('pairing')
  createPairing(@CurrentUser() user, @Param('id') id: string, @Body() dto: CreatePairingDto) {
    return this.devices.createPairing(user, id, dto.deviceName);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.STORE_MANAGER)
  @Get()
  list(@CurrentUser() user, @Param('id') id: string) {
    return this.devices.listDevices(user, id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post(':deviceId/revoke')
  revoke(@Param('id') id: string, @Param('deviceId') deviceId: string) {
    return this.devices.revoke(id, deviceId);
  }
}
