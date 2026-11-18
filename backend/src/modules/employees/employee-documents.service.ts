import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeDocumentType, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/utils/outlet-scope.util';
import { PRIVATE_STORAGE_ROOT } from '../../common/utils/attendance-photo.util';

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN];

/** Berkas yang diterima, dikenali dari isi (bukan dari nama/tipe kiriman browser). */
function detectType(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  return null;
}

export interface UploadedDocumentFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/** Dokumen pribadi karyawan (KTP, KK, kontrak, ...). Disimpan di storage/ privat, hanya HR & Super Admin. */
@Injectable()
export class EmployeeDocumentsService {
  constructor(private prisma: PrismaService) {}

  async list(actor: AuthUser, employeeId: string) {
    await this.employeeFor(actor, employeeId);
    return this.prisma.employeeDocument.findMany({
      where: { employeeId },
      select: {
        id: true,
        type: true,
        fileName: true,
        mimeType: true,
        size: true,
        note: true,
        createdAt: true,
        uploadedBy: { select: { username: true, profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(actor: AuthUser, employeeId: string, type: EmployeeDocumentType, note: string | undefined, file?: UploadedDocumentFile) {
    await this.employeeFor(actor, employeeId);
    if (!file?.buffer?.length) throw new BadRequestException('Pilih berkas yang akan diunggah');
    if (file.size > MAX_DOCUMENT_BYTES) throw new BadRequestException('Ukuran berkas maksimal 5 MB');
    const kind = detectType(file.buffer);
    if (!kind) throw new BadRequestException('Berkas harus PDF, JPG atau PNG');

    const relDir = join('documents', employeeId);
    const storagePath = join(relDir, `${randomUUID()}.${kind.ext}`);
    await mkdir(join(PRIVATE_STORAGE_ROOT, relDir), { recursive: true });
    await writeFile(join(PRIVATE_STORAGE_ROOT, storagePath), file.buffer);

    // Nama asli hanya untuk tampilan dan unduhan; tidak dipakai sebagai path
    const fileName = (file.originalname || `dokumen.${kind.ext}`).replace(/[\\/\r\n"]/g, '_').slice(0, 150);
    try {
      return await this.prisma.employeeDocument.create({
        data: { employeeId, type, fileName, mimeType: kind.mime, size: file.size, storagePath, note: note?.trim() || null, uploadedById: actor.id },
        select: { id: true, type: true, fileName: true, mimeType: true, size: true, note: true, createdAt: true },
      });
    } catch (e) {
      await rm(join(PRIVATE_STORAGE_ROOT, storagePath), { force: true });
      throw e;
    }
  }

  async file(actor: AuthUser, employeeId: string, documentId: string) {
    await this.employeeFor(actor, employeeId);
    const doc = await this.getDoc(employeeId, documentId);
    return { doc, data: await readFile(join(PRIVATE_STORAGE_ROOT, doc.storagePath)) };
  }

  async remove(actor: AuthUser, employeeId: string, documentId: string) {
    await this.employeeFor(actor, employeeId);
    const doc = await this.getDoc(employeeId, documentId);
    await this.prisma.employeeDocument.delete({ where: { id: doc.id } });
    await rm(join(PRIVATE_STORAGE_ROOT, doc.storagePath), { force: true });
    return { id: doc.id };
  }

  private async employeeFor(actor: AuthUser, employeeId: string) {
    const employee = await this.prisma.employeeProfile.findUnique({ where: { id: employeeId }, include: { user: true } });
    if (!employee) throw new NotFoundException('Karyawan tidak ditemukan');
    // Dokumen akun admin hanya untuk Super Admin
    if (ADMIN_ROLES.includes(employee.user.role) && actor.role !== UserRole.SUPER_ADMIN && employee.userId !== actor.id) {
      throw new ForbiddenException('Hanya Super Admin yang bisa mengelola dokumen akun admin');
    }
    return employee;
  }

  private async getDoc(employeeId: string, documentId: string) {
    const doc = await this.prisma.employeeDocument.findFirst({ where: { id: documentId, employeeId } });
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan');
    return doc;
  }
}
