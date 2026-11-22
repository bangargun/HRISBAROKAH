import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface DeviceContext {
  deviceId: string;
  outletId: string;
}

export const hashDeviceToken = (token: string) => createHash('sha256').update(token).digest('hex');

const LAST_SEEN_INTERVAL_MS = 60_000;

/** Autentikasi tablet: Authorization: Bearer <token perangkat>. */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const match = header?.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new UnauthorizedException('Tablet belum terpasang');

    const device = await this.prisma.attendanceDevice.findUnique({
      where: { tokenHash: hashDeviceToken(match[1]) },
    });
    if (!device || device.revokedAt) {
      throw new UnauthorizedException('Tablet tidak terdaftar atau sudah dicabut');
    }

    // Cukup sekali per menit agar tidak menulis di setiap permintaan
    const now = new Date();
    await this.prisma.attendanceDevice.updateMany({
      where: {
        id: device.id,
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(now.getTime() - LAST_SEEN_INTERVAL_MS) } }],
      },
      data: { lastSeenAt: now },
    });

    req.device = { deviceId: device.id, outletId: device.outletId } satisfies DeviceContext;
    return true;
  }
}

export const CurrentDevice = createParamDecorator((_data: unknown, ctx: ExecutionContext): DeviceContext | null => {
  return ctx.switchToHttp().getRequest().device ?? null;
});
