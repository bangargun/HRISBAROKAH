import { Injectable, Logger } from '@nestjs/common';
import { RequestStatus, RequestType, UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BUSINESS_TIMEZONE } from '../../common/utils/business-date.util';
import { TelegramClient } from './telegram.client';

export const REQUEST_LABEL: Record<RequestType, string> = {
  KASBON: 'Kasbon',
  CUTI_TAHUNAN: 'Cuti tahunan',
  CUTI_KHUSUS: 'Cuti khusus',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  LEMBUR: 'Lembur',
  TUKAR_SHIFT: 'Tukar shift',
};
const LINK_TTL_MS = 15 * 60_000;
const REVIEW_THROTTLE_MS = 2 * 60 * 60_000;

const day = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: BUSINESS_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

/**
 * Notifikasi Telegram untuk kejadian yang menunggu tindakan atau hasil pengajuan.
 * Semua metode kejadian dipanggil SETELAH data tersimpan dan tidak pernah melempar error:
 * Telegram yang gagal hanya dicatat, tidak menggagalkan pengajuan/persetujuan.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly lastReviewNotice = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramClient,
  ) {}

  /** Tautan ke web admin, mis. adminLink('requests') → https://DOMAIN/?menu=requests */
  adminLink(menu: string, tab?: string) {
    if (!this.telegram.publicUrl) return undefined;
    return `${this.telegram.publicUrl}/?menu=${menu}${tab ? `&tab=${tab}` : ''}`;
  }
  crewLink() {
    return this.telegram.publicUrl ? `${this.telegram.publicUrl}/kru/` : undefined;
  }

  // ---------- hubungan akun ↔ chat ----------

  async status(userId: string) {
    const link = await this.prisma.telegramLink.findUnique({ where: { userId } });
    return {
      available: this.telegram.enabled,
      linked: !!link,
      telegramUsername: link?.telegramUsername ?? null,
    };
  }

  async createLink(userId: string) {
    const bot = await this.telegram.username();
    if (!bot) return { url: null };
    const code = randomBytes(18).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.telegramLinkCode.deleteMany({ where: { OR: [{ userId }, { expiresAt: { lt: new Date() } }] } }),
      this.prisma.telegramLinkCode.create({ data: { code, userId, expiresAt: new Date(Date.now() + LINK_TTL_MS) } }),
    ]);
    return { url: `https://t.me/${bot}?start=${code}` };
  }

  async unlink(userId: string) {
    await this.prisma.telegramLink.deleteMany({ where: { userId } });
    return this.status(userId);
  }

  /** Pesan masuk dari webhook bot. */
  async handleIncoming(chatId: string, text: string, telegramUsername?: string) {
    const [command, arg] = text.trim().split(/\s+/, 2);
    if (command === '/start' && arg) {
      const found = await this.prisma.telegramLinkCode.findUnique({
        where: { code: arg },
        include: { user: { select: { id: true, isActive: true, username: true, profile: { select: { fullName: true } } } } },
      });
      if (!found || found.expiresAt < new Date() || !found.user.isActive) {
        await this.telegram.send(chatId, 'Tautan sudah kedaluwarsa. Buka lagi menu Hubungkan Telegram di aplikasi HRIS.');
        return;
      }
      await this.prisma.$transaction([
        this.prisma.telegramLinkCode.deleteMany({ where: { userId: found.userId } }),
        // Chat ini mungkin sebelumnya terhubung ke akun lain: dipindahkan
        this.prisma.telegramLink.deleteMany({ where: { OR: [{ chatId }, { userId: found.userId }] } }),
        this.prisma.telegramLink.create({ data: { userId: found.userId, chatId, telegramUsername: telegramUsername ?? null } }),
      ]);
      const name = found.user.profile?.fullName ?? found.user.username;
      await this.telegram.send(chatId, `✅ Terhubung sebagai ${name}. Notifikasi HRIS akan dikirim ke sini. Ketik /stop untuk berhenti.`);
      return;
    }
    if (command === '/stop') {
      const removed = await this.prisma.telegramLink.deleteMany({ where: { chatId } });
      await this.telegram.send(chatId, removed.count ? 'Notifikasi HRIS dihentikan.' : 'Chat ini belum terhubung ke akun HRIS.');
      return;
    }
    await this.telegram.send(
      chatId,
      'Ini bot notifikasi HRIS Barokah Group. Untuk menghubungkan, buka aplikasi HRIS → Hubungkan Telegram.',
    );
  }

  // ---------- pengiriman ----------

  /** Kirim ke akun yang terhubung dan aktif. Tidak pernah melempar. */
  async notify(userIds: string[], text: string, link?: string) {
    if (!this.telegram.enabled || userIds.length === 0) return;
    try {
      const links = await this.prisma.telegramLink.findMany({
        where: { userId: { in: Array.from(new Set(userIds)) }, user: { isActive: true } },
      });
      for (const l of links) {
        const res = await this.telegram.send(l.chatId, text, link);
        if (res.gone) await this.prisma.telegramLink.deleteMany({ where: { chatId: l.chatId } });
      }
    } catch (err) {
      this.logger.warn(`Notifikasi gagal: ${(err as Error).message}`);
    }
  }

  /** Jalankan kejadian tanpa menunggu dan tanpa pernah menggagalkan pemanggil. */
  fire(task: () => Promise<unknown>) {
    if (!this.telegram.enabled) return;
    void task().catch((err) => this.logger.warn(`Notifikasi gagal: ${(err as Error).message}`));
  }

  // ---------- penerima ----------

  /** Kepala cabang: akun Kepala Cabang di cabang itu + manajer yang ditetapkan di data cabang. */
  async storeManagers(outletId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: UserRole.STORE_MANAGER, profile: { outletId } },
          { profile: { managedOutlet: { id: outletId } } },
        ],
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /** Admin dengan peran tertentu; bila tidak ada satu pun, Super Admin. */
  async admins(roles: UserRole[]) {
    let users = await this.prisma.user.findMany({ where: { isActive: true, role: { in: roles } }, select: { id: true } });
    if (users.length === 0) {
      users = await this.prisma.user.findMany({ where: { isActive: true, role: UserRole.SUPER_ADMIN }, select: { id: true } });
    }
    return users.map((u) => u.id);
  }

  private async requestWithEmployee(requestId: string) {
    return this.prisma.employeeRequest.findUnique({
      where: { id: requestId },
      include: {
        kasbonLoan: true,
        employee: { select: { userId: true, fullName: true, outletId: true, outlet: { select: { name: true } } } },
      },
    });
  }

  private describe(r: NonNullable<Awaited<ReturnType<NotificationsService['requestWithEmployee']>>>) {
    const what =
      r.type === RequestType.KASBON && r.kasbonLoan
        ? `${rupiah(Number(r.kasbonLoan.amount))}${r.kasbonLoan.tenorMonths > 1 ? `, ${r.kasbonLoan.tenorMonths} bulan` : ''}`
        : r.startDate
          ? `${day(r.startDate)}${r.endDate && r.totalDays && r.totalDays > 1 ? ` – ${day(r.endDate)} (${r.totalDays} hari)` : ''}`
          : '';
    return `${REQUEST_LABEL[r.type]}${what ? ` · ${what}` : ''}`;
  }

  // ---------- kejadian ----------

  /** Pengajuan baru dari HP atau tablet → Kepala Cabang (tanpa kepala → HR). */
  async requestCreated(requestId: string) {
    const r = await this.requestWithEmployee(requestId);
    if (!r || r.status !== RequestStatus.PENDING_STORE_MANAGER) return;
    let to = await this.storeManagers(r.employee.outletId);
    to = to.filter((id) => id !== r.employee.userId);
    if (to.length === 0) to = await this.admins([UserRole.HR_ADMIN]);
    await this.notify(
      to,
      `📝 Pengajuan baru menunggu persetujuan\n${r.employee.fullName} (${r.employee.outlet.name})\n${this.describe(r)}\nAlasan: ${r.reason}`,
      this.adminLink('requests'),
    );
  }

  /** Setelah keputusan Kepala Cabang atau HR. */
  async requestReviewed(requestId: string) {
    const r = await this.requestWithEmployee(requestId);
    if (!r) return;
    const summary = `${this.describe(r)}`;
    if (r.status === RequestStatus.PENDING_HR) {
      const roles = r.type === RequestType.KASBON ? [UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN] : [UserRole.HR_ADMIN];
      await this.notify(
        await this.admins(roles),
        `📝 Pengajuan menunggu HR (sudah disetujui Kepala Cabang)\n${r.employee.fullName} (${r.employee.outlet.name})\n${summary}\nAlasan: ${r.reason}`,
        this.adminLink('requests'),
      );
      return;
    }
    if (r.status === RequestStatus.APPROVED) {
      await this.notify([r.employee.userId], `✅ Pengajuan disetujui\n${summary}`, this.crewLink());
      if (r.type === RequestType.KASBON) {
        await this.notify(
          await this.admins([UserRole.FINANCE_ADMIN]),
          `💸 Kasbon disetujui, siap dicairkan\n${r.employee.fullName} (${r.employee.outlet.name})\n${summary}`,
          this.adminLink('requests'),
        );
      }
      return;
    }
    if (r.status === RequestStatus.REJECTED) {
      const note = r.hrNotes ?? r.managerNotes ?? '-';
      await this.notify([r.employee.userId], `❌ Pengajuan ditolak\n${summary}\nAlasan: ${note}`, this.crewLink());
      return;
    }
    if (r.status === RequestStatus.DISBURSED) {
      await this.notify([r.employee.userId], `💸 Kasbon sudah dicairkan\n${summary}`, this.crewLink());
    }
  }

  async bankChangeCreated(changeId: string) {
    const c = await this.prisma.bankAccountChange.findUnique({
      where: { id: changeId },
      include: { employee: { select: { fullName: true, outlet: { select: { name: true } } } } },
    });
    if (!c || c.status !== 'PENDING') return;
    const differs = c.bankAccountHolder.trim().toLowerCase() !== c.employee.fullName.trim().toLowerCase();
    await this.notify(
      await this.admins([UserRole.HR_ADMIN]),
      `🏦 Perubahan rekening menunggu persetujuan\n${c.employee.fullName} (${c.employee.outlet.name})\n${c.bankName} ${c.bankAccountNumber} a.n. ${c.bankAccountHolder}${differs ? '\n⚠️ Nama pemilik berbeda dari nama karyawan' : ''}`,
      this.adminLink('employees', 'bank-changes'),
    );
  }

  async bankChangeDecided(changeId: string) {
    const c = await this.prisma.bankAccountChange.findUnique({
      where: { id: changeId },
      include: { employee: { select: { userId: true } } },
    });
    if (!c || c.status === 'PENDING') return;
    const account = `${c.bankName} ${c.bankAccountNumber}`;
    await this.notify(
      [c.employee.userId],
      c.status === 'APPROVED'
        ? `✅ Rekening gaji diganti ke ${account}`
        : `❌ Perubahan rekening ke ${account} ditolak\nAlasan: ${c.note ?? '-'}`,
      this.crewLink(),
    );
  }

  async correctionCreated(correctionId: string) {
    const c = await this.prisma.attendanceCorrection.findUnique({
      where: { id: correctionId },
      include: { employee: { select: { fullName: true, outlet: { select: { name: true } } } } },
    });
    if (!c || c.status !== 'PENDING') return;
    await this.notify(
      await this.admins([UserRole.HR_ADMIN]),
      `🕒 Koreksi absen menunggu persetujuan\n${c.employee.fullName} (${c.employee.outlet.name}) · ${day(c.date)}\nAlasan: ${c.reason}`,
      this.adminLink('attendance', 'attendance-corrections'),
    );
  }

  /** Absen tablet perlu ditinjau: paling banyak satu pesan per 2 jam per cabang. */
  async reviewNeeded(outletId: string) {
    const last = this.lastReviewNotice.get(outletId) ?? 0;
    if (Date.now() - last < REVIEW_THROTTLE_MS) return;
    this.lastReviewNotice.set(outletId, Date.now());
    const [count, outlet] = await Promise.all([
      this.prisma.attendanceEvent.count({ where: { outletId, status: 'NEEDS_REVIEW' } }),
      this.prisma.outlet.findUnique({ where: { id: outletId }, select: { name: true } }),
    ]);
    if (!count) return;
    await this.notify(
      await this.storeManagers(outletId),
      `👀 ${count} absen tablet di ${outlet?.name ?? 'cabang'} perlu ditinjau`,
      this.adminLink('attendance', 'attendance-review'),
    );
  }
}
