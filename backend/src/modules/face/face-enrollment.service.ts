import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FaceCheckKind, UserRole } from '@prisma/client';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { businessDateString, businessDayRange, parseDateParam } from '../../common/utils/business-date.util';
import { rm } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PRIVATE_STORAGE_ROOT,
  decodePhoto,
  saveAttendancePhoto,
  saveFaceReferencePhoto,
} from '../../common/utils/attendance-photo.util';
import { FaceRecognitionService } from './face-recognition.service';
import { EnrollFaceDto } from './face.dto';

// Peran admin bukan kru lapangan (sama dengan roster tablet)
const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN];

export interface FaceVerification {
  photoUrl: string;
  score: number;
}

@Injectable()
export class FaceEnrollmentService {
  constructor(
    private prisma: PrismaService,
    private face: FaceRecognitionService,
  ) {}

  private async getEmployeeFor(actor: AuthUser, employeeId: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Karyawan tidak ditemukan');
    }
    // Store Manager hanya boleh mengelola wajah karyawan di outletnya sendiri
    assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa mengelola wajah karyawan di outlet Anda');
    return employee;
  }

  async getStatus(actor: AuthUser, employeeId: string) {
    const employee = await this.getEmployeeFor(actor, employeeId);
    const samples = await this.prisma.faceEnrollment.findMany({
      where: { employeeId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      employeeId,
      enrolled: samples.length > 0,
      samples: samples.length,
      enrolledAt: samples[0]?.createdAt ?? null,
      consentAt: employee.faceConsentAt,
    };
  }

  /** Daftarkan ulang wajah karyawan; data wajah lama diganti. */
  async enroll(actor: AuthUser, employeeId: string, dto: EnrollFaceDto) {
    await this.getEmployeeFor(actor, employeeId);

    const photos = dto.photosBase64.map((p) => decodePhoto(p));
    const embeddings: number[][] = [];
    for (const [i, photo] of photos.entries()) {
      try {
        embeddings.push(await this.face.describe(photo.buffer));
      } catch (e) {
        throw new BadRequestException(`Foto ke-${i + 1}: ${e.message}`);
      }
    }

    // Semua foto harus orang yang sama, supaya tidak tercampur wajah orang lain
    for (let i = 1; i < embeddings.length; i++) {
      const score = this.face.similarity(embeddings[0], embeddings[i]);
      if (score < this.face.matchThreshold) {
        throw new BadRequestException(
          `Foto ke-${i + 1} tidak terlihat seperti orang yang sama dengan foto pertama. Ulangi pendaftaran.`,
        );
      }
    }

    const photoPaths = await Promise.all(photos.map((p) => saveFaceReferencePhoto(employeeId, p)));
    const old = await this.prisma.faceEnrollment.findMany({
      where: { employeeId },
      select: { photoPath: true },
    });

    await this.prisma.$transaction([
      this.prisma.faceEnrollment.deleteMany({ where: { employeeId } }),
      this.prisma.faceEnrollment.createMany({
        data: embeddings.map((embedding, i) => ({
          employeeId,
          embedding,
          photoPath: photoPaths[i],
          enrolledById: actor.id,
        })),
      }),
      this.prisma.employeeProfile.update({
        where: { id: employeeId },
        data: { faceConsentAt: new Date() },
      }),
    ]);
    await this.removeFiles(old.map((o) => o.photoPath));

    return this.getStatus(actor, employeeId);
  }

  /** Hapus data wajah (misal karyawan resign atau menarik persetujuan). */
  async remove(actor: AuthUser, employeeId: string) {
    await this.getEmployeeFor(actor, employeeId);
    const old = await this.prisma.faceEnrollment.findMany({
      where: { employeeId },
      select: { photoPath: true },
    });

    await this.prisma.$transaction([
      this.prisma.faceEnrollment.deleteMany({ where: { employeeId } }),
      this.prisma.employeeProfile.update({
        where: { id: employeeId },
        data: { faceConsentAt: null },
      }),
    ]);
    await this.removeFiles(old.map((o) => o.photoPath));
    await rm(join(PRIVATE_STORAGE_ROOT, 'faces', employeeId), {
      recursive: true,
      force: true,
    });

    return { message: 'Data wajah karyawan sudah dihapus' };
  }

  /**
   * Skor kemiripan foto dengan wajah terdaftar karyawan. Tidak melempar error dan tidak
   * menulis FaceCheckLog; `reason` terisi bila tidak cocok atau wajah tidak terbaca.
   */
  async scoreAgainst(
    employeeId: string,
    photo: Buffer,
  ): Promise<{ score: number | null; enrolled: boolean; reason: string | null }> {
    const references = await this.prisma.faceEnrollment.findMany({
      where: { employeeId },
      select: { embedding: true },
    });
    if (references.length === 0) {
      return { score: null, enrolled: false, reason: 'Wajah belum didaftarkan' };
    }
    try {
      const embedding = await this.face.describe(photo);
      const score = this.face.bestScore(
        embedding,
        references.map((r) => r.embedding),
      );
      return {
        score,
        enrolled: true,
        reason: score < this.face.matchThreshold ? 'Wajah tidak cocok dengan wajah terdaftar' : null,
      };
    } catch (e) {
      return { score: null, enrolled: true, reason: e.message };
    }
  }

  /**
   * Cari kru aktif yang wajahnya paling mirip (minimal ambang cocok). Null bila tidak
   * ada wajah, lebih dari satu wajah, atau tidak ada yang cocok.
   */
  async identify(photo: Buffer): Promise<{ employeeId: string; score: number } | null> {
    let embedding: number[];
    try {
      embedding = await this.face.describe(photo);
    } catch {
      return null;
    }
    const rows = await this.prisma.faceEnrollment.findMany({
      where: {
        employee: { user: { isActive: true, role: { notIn: ADMIN_ROLES } } },
      },
      select: { employeeId: true, embedding: true },
    });
    let best: { employeeId: string; score: number } | null = null;
    for (const r of rows) {
      // Embedding dengan panjang berbeda (data lama/rusak) tidak bisa dibandingkan
      if (r.embedding.length !== embedding.length) continue;
      const score = this.face.similarity(embedding, r.embedding);
      if (score >= this.face.matchThreshold && (!best || score > best.score)) {
        best = { employeeId: r.employeeId, score };
      }
    }
    return best;
  }

  /**
   * Cocokkan selfie absen dengan wajah terdaftar. Setiap percobaan dicatat di FaceCheckLog,
   * termasuk yang ditolak, agar HR bisa memeriksa dugaan titip absen.
   */
  async verifyForAttendance(employeeId: string, photoBase64: string, kind: FaceCheckKind): Promise<FaceVerification> {
    const photo = decodePhoto(photoBase64);
    const { score, enrolled, reason } = await this.scoreAgainst(employeeId, photo.buffer);
    if (!enrolled) {
      throw new BadRequestException(
        'Wajah Anda belum didaftarkan. Minta HR atau Store Manager mendaftarkan wajah Anda.',
      );
    }
    const photoUrl = await saveAttendancePhoto(photo);

    await this.prisma.faceCheckLog.create({
      data: {
        employeeId,
        kind,
        score,
        accepted: reason === null,
        reason,
        photoUrl,
      },
    });

    if (reason !== null) {
      throw new BadRequestException(`Absen ditolak: ${reason}.`);
    }
    return { photoUrl, score: score! };
  }

  async getCheckLogs(actor: AuthUser, outletId?: string, dateStr?: string, onlyRejected?: boolean) {
    // Store Manager tanpa outlet kini ditolak, bukan melihat semua outlet
    outletId = scopedOutletId(actor, outletId);
    const { start: day, end: nextDay } = businessDayRange(dateStr ? parseDateParam(dateStr) : businessDateString());

    return this.prisma.faceCheckLog.findMany({
      where: {
        createdAt: { gte: day, lt: nextDay },
        ...(onlyRejected && { accepted: false }),
        ...(outletId && { employee: { outletId } }),
      },
      include: {
        employee: {
          select: {
            id: true,
            nik: true,
            fullName: true,
            outlet: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async removeFiles(relPaths: string[]) {
    await Promise.all(relPaths.map((p) => rm(join(PRIVATE_STORAGE_ROOT, p), { force: true })));
  }
}
