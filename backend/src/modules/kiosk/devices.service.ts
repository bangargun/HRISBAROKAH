import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess } from '../../common/utils/outlet-scope.util';
import { AttemptLimiter } from './attempt-limiter';
import { hashDeviceToken } from './device-auth.guard';

// Tanpa 0/O/1/I agar tidak tertukar saat diketik
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_TTL_MS = 15 * 60_000;
const INVALID_CODE = 'Kode tidak berlaku';

@Injectable()
export class DevicesService {
  private pairLimiter = new AttemptLimiter(10, 10 * 60_000);

  constructor(private prisma: PrismaService) {}

  private async getOutletOrThrow(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new NotFoundException('Cabang tidak ditemukan');
    return outlet;
  }

  async createPairing(actor: AuthUser, outletId: string, deviceName: string) {
    await this.getOutletOrThrow(outletId);
    assertOutletAccess(actor, outletId, 'Anda tidak bisa mengelola tablet cabang lain');
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      try {
        await this.prisma.attendanceDevicePairing.create({
          data: { code, outletId, deviceName, expiresAt, createdById: actor.id },
        });
        return { code, expiresAt };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // kode kembar
        throw e;
      }
    }
    throw new BadRequestException('Gagal membuat kode, coba lagi');
  }

  async listDevices(actor: AuthUser, outletId: string) {
    await this.getOutletOrThrow(outletId);
    assertOutletAccess(actor, outletId, 'Anda tidak bisa melihat tablet cabang lain');
    return this.prisma.attendanceDevice.findMany({
      where: { outletId },
      select: { id: true, name: true, pairedAt: true, lastSeenAt: true, revokedAt: true },
      orderBy: { pairedAt: 'desc' },
    });
  }

  async revoke(actor: AuthUser, outletId: string, deviceId: string) {
    assertOutletAccess(actor, outletId, 'Anda tidak bisa mengelola tablet cabang lain');
    const device = await this.prisma.attendanceDevice.findFirst({ where: { id: deviceId, outletId } });
    if (!device) throw new NotFoundException('Tablet tidak ditemukan');
    if (!device.revokedAt) {
      await this.prisma.attendanceDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
    }
    return { ok: true };
  }

  /** Tukar kode pairing dengan token perangkat (sekali pakai). */
  async pair(code: string, ip: string) {
    // Pesan jatah dulu secara sinkron agar tebakan paralel tidak lolos pemeriksaan
    if (!this.pairLimiter.tryAcquire(ip)) {
      throw new HttpException('Terlalu banyak percobaan, coba lagi beberapa menit lagi', HttpStatus.TOO_MANY_REQUESTS);
    }

    const token = randomBytes(32).toString('base64url');
    const result = await this.prisma.$transaction(async (tx) => {
      // Klaim atomik: hanya satu permintaan yang bisa memakai kode ini
      const claimed = await tx.attendanceDevicePairing.updateMany({
        where: { code, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return null;
      const pairing = await tx.attendanceDevicePairing.findUniqueOrThrow({
        where: { code },
        include: { outlet: { select: { id: true, name: true } } },
      });
      const device = await tx.attendanceDevice.create({
        data: {
          outletId: pairing.outletId,
          name: pairing.deviceName,
          tokenHash: hashDeviceToken(token),
          createdById: pairing.createdById,
        },
      });
      return { device, outlet: pairing.outlet };
    });

    if (!result) throw new BadRequestException(INVALID_CODE); // percobaan gagal tetap terhitung
    this.pairLimiter.release(ip);
    return {
      token,
      device: { id: result.device.id, name: result.device.name },
      outlet: { id: result.outlet.id, name: result.outlet.name },
    };
  }
}
