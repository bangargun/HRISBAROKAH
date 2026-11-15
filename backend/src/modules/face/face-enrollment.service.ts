import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FaceCheckKind } from '@prisma/client';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
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
   * Cocokkan selfie absen dengan wajah terdaftar. Setiap percobaan dicatat di FaceCheckLog,
   * termasuk yang ditolak, agar HR bisa memeriksa dugaan titip absen.
   */
  async verifyForAttendance(employeeId: string, photoBase64: string, kind: FaceCheckKind): Promise<FaceVerification> {
    const references = await this.prisma.faceEnrollment.findMany({
      where: { employeeId },
      select: { embedding: true },
    });
    if (references.length === 0) {
      throw new BadRequestException(
        'Wajah Anda belum didaftarkan. Minta HR atau Store Manager mendaftarkan wajah Anda.',
      );
    }

    const photo = decodePhoto(photoBase64);
    const photoUrl = await saveAttendancePhoto(photo);

    let score: number | null = null;
    let reason: string | null = null;
    try {
      const embedding = await this.face.describe(photo.buffer);
      score = this.face.bestScore(
        embedding,
        references.map((r) => r.embedding),
      );
      if (score < this.face.matchThreshold) {
        reason = 'Wajah tidak cocok dengan wajah terdaftar';
      }
    } catch (e) {
      reason = e.message;
    }

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
    return { photoUrl, score };
  }

  async getCheckLogs(actor: AuthUser, outletId?: string, dateStr?: string, onlyRejected?: boolean) {
    // Store Manager tanpa outlet kini ditolak, bukan melihat semua outlet
    outletId = scopedOutletId(actor, outletId);
    const day = dateStr ? new Date(dateStr) : new Date();
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

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
