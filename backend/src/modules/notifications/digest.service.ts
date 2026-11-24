import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RequestStatus, RequestType, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BUSINESS_TIMEZONE, businessDateString } from '../../common/utils/business-date.util';
import { NotificationsService } from './notifications.service';
import { TelegramClient } from './telegram.client';

const STATE_KEY = 'morning-digest-date';
const DIGEST_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.HR_ADMIN,
  UserRole.FINANCE_ADMIN,
  UserRole.AREA_MANAGER,
  UserRole.STORE_MANAGER,
];

/**
 * Ringkasan pagi: setiap hari antara 08:00 dan 12:00 WIB, sekali saja (tanggal terakhir disimpan di
 * database, jadi restart server tidak mengirim dua kali). Hanya untuk yang masih punya pekerjaan.
 */
@Injectable()
export class DigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DigestService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private telegram: TelegramClient,
  ) {}

  onModuleInit() {
    if (!this.telegram.enabled) return;
    this.timer = setInterval(() => void this.tick(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private hourNow() {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TIMEZONE, hour: '2-digit', hour12: false }).format(new Date()));
  }

  private async tick() {
    const hour = this.hourNow();
    if (hour < 8 || hour >= 12) return;
    try {
      if (await this.claim(businessDateString())) await this.send();
    } catch (err) {
      this.logger.warn(`Ringkasan pagi gagal: ${(err as Error).message}`);
    }
  }

  /** Tandai hari ini sudah dikirim; false bila sudah (oleh proses ini atau sebelumnya). */
  async claim(today: string) {
    const created = await this.prisma.appState.createMany({ data: [{ key: STATE_KEY, value: today }], skipDuplicates: true });
    if (created.count) return true;
    const updated = await this.prisma.appState.updateMany({ where: { key: STATE_KEY, value: { not: today } }, data: { value: today } });
    return updated.count > 0;
  }

  /** Kirim ringkasan ke semua akun terhubung yang punya pekerjaan menunggu. Mengembalikan jumlah penerima. */
  async send() {
    const links = await this.prisma.telegramLink.findMany({
      where: { user: { isActive: true, role: { in: DIGEST_ROLES } } },
      include: { user: { select: { id: true, role: true, profile: { select: { outletId: true } } } } },
    });
    let sent = 0;
    for (const l of links) {
      const lines = await this.linesFor(l.user.role, l.user.profile?.outletId);
      if (!lines.length) continue;
      await this.notifications.notify(
        [l.user.id],
        `☀️ Ringkasan pagi HRIS: masih menunggu\n${lines.map((x) => `• ${x}`).join('\n')}`,
        this.notifications.adminLink('requests'),
      );
      sent++;
    }
    return sent;
  }

  private async linesFor(role: UserRole, outletId?: string) {
    const p = this.prisma;
    const byOutlet = role === UserRole.STORE_MANAGER ? { employee: { outletId } } : {};
    const lines: [string, number][] = [];
    const add = async (label: string, n: Promise<number>) => lines.push([label, await n]);
    const is = (...roles: UserRole[]) => roles.includes(role);

    if (role === UserRole.STORE_MANAGER && !outletId) return [];
    if (is(UserRole.STORE_MANAGER, UserRole.AREA_MANAGER, UserRole.SUPER_ADMIN)) {
      await add('pengajuan menunggu Kepala Cabang', p.employeeRequest.count({ where: { status: RequestStatus.PENDING_STORE_MANAGER, ...byOutlet } }));
    }
    if (is(UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)) {
      await add('pengajuan menunggu HR', p.employeeRequest.count({ where: { status: RequestStatus.PENDING_HR } }));
      await add('perubahan rekening', p.bankAccountChange.count({ where: { status: 'PENDING' } }));
      await add('koreksi absen', p.attendanceCorrection.count({ where: { status: 'PENDING' } }));
    }
    if (role === UserRole.FINANCE_ADMIN) {
      await add('kasbon menunggu persetujuan', p.employeeRequest.count({ where: { status: RequestStatus.PENDING_HR, type: RequestType.KASBON } }));
    }
    if (is(UserRole.FINANCE_ADMIN, UserRole.SUPER_ADMIN)) {
      await add('kasbon siap dicairkan', p.employeeRequest.count({ where: { status: RequestStatus.APPROVED, type: RequestType.KASBON } }));
    }
    if (is(UserRole.STORE_MANAGER, UserRole.HR_ADMIN, UserRole.SUPER_ADMIN)) {
      await add(
        'absen tablet perlu ditinjau',
        p.attendanceEvent.count({ where: { status: 'NEEDS_REVIEW', ...(role === UserRole.STORE_MANAGER && { outletId }) } }),
      );
    }
    return lines.filter(([, n]) => n > 0).map(([label, n]) => `${n} ${label}`);
  }
}
