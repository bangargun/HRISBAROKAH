import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessDateString, businessToday, parseDateParam, toDateOnly } from '../../common/utils/business-date.util';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { UPLOADS_ROOT, decodePhoto, savePublicPhoto } from '../../common/utils/attendance-photo.util';
import { DAILY_REPORT_CATEGORIES, DAILY_REPORT_CHECKLIST, DAILY_REPORT_KEYS } from './daily-report.checklist';
import { SubmitDailyReportPhotoDto } from './daily-reports.dto';

@Injectable()
export class DailyReportsService {
  constructor(private prisma: PrismaService) {}

  checklist() {
    return { categories: DAILY_REPORT_CATEGORIES, items: DAILY_REPORT_CHECKLIST };
  }

  /** Laporan satu tanggal untuk setiap cabang aktif (dalam cakupan pengguna). */
  async forDate(actor: AuthUser, dateStr?: string, outletId?: string) {
    const date = dateStr ? toDateOnly(parseDateParam(dateStr)) : businessToday();
    outletId = scopedOutletId(actor, outletId);
    const [outlets, photos] = await Promise.all([
      this.prisma.outlet.findMany({
        where: { isActive: true, ...(outletId && { id: outletId }) },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.dailyReportPhoto.findMany({
        where: { date, ...(outletId && { outletId }) },
        include: { submittedBy: { select: { username: true, profile: { select: { fullName: true } } } } },
      }),
    ]);
    return {
      date: date.toISOString().slice(0, 10),
      total: DAILY_REPORT_CHECKLIST.length,
      outlets: outlets.map((o) => ({
        outlet: o,
        photos: photos.filter((p) => p.outletId === o.id),
      })),
    };
  }

  /**
   * Kirim/ganti foto satu item untuk hari ini. Laporan kemarin masih boleh dilengkapi
   * (closing lewat tengah malam), tanggal lain tidak.
   */
  async submit(actor: AuthUser, dateStr: string, itemKey: string, dto: SubmitDailyReportPhotoDto) {
    if (!DAILY_REPORT_KEYS.has(itemKey)) throw new NotFoundException('Item laporan tidak dikenal');
    const ymd = parseDateParam(dateStr);
    const today = businessDateString();
    const yesterday = new Date(toDateOnly(today).getTime() - 86_400_000).toISOString().slice(0, 10);
    if (ymd !== today && ymd !== yesterday) {
      throw new BadRequestException('Laporan hanya bisa diisi untuk hari ini atau kemarin');
    }

    const outletId =
      actor.role === UserRole.STORE_MANAGER ? scopedOutletId(actor) : dto.outletId;
    if (!outletId) throw new BadRequestException('Pilih cabang');
    assertOutletAccess(actor, outletId, 'Anda hanya bisa mengisi laporan cabang Anda');
    const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet?.isActive) throw new BadRequestException('Cabang tidak ditemukan atau nonaktif');

    const photoUrl = await savePublicPhoto('daily-reports', decodePhoto(dto.photoBase64, 'Foto laporan'));
    const date = toDateOnly(ymd);
    const data = { photoUrl, notes: dto.notes || null, submittedById: actor.id, submittedAt: new Date() };
    const previous = await this.prisma.dailyReportPhoto.findUnique({
      where: { outletId_date_itemKey: { outletId, date, itemKey } },
      select: { photoUrl: true },
    });
    const saved = await this.prisma.dailyReportPhoto.upsert({
      where: { outletId_date_itemKey: { outletId, date, itemKey } },
      create: { outletId, date, itemKey, ...data },
      update: data,
      include: { submittedBy: { select: { username: true, profile: { select: { fullName: true } } } } },
    });
    // Foto yang diganti tidak dipakai lagi; hapus berkasnya (gagal hapus tidak menggagalkan laporan)
    if (previous?.photoUrl.startsWith('/uploads/daily-reports/')) {
      await unlink(join(UPLOADS_ROOT, previous.photoUrl.slice('/uploads/'.length))).catch(() => undefined);
    }
    return saved;
  }
}
