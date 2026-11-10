import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// Disajikan publik di /uploads (foto selfie absensi)
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
// Tidak disajikan publik (foto acuan wajah karyawan)
export const PRIVATE_STORAGE_ROOT = join(process.cwd(), 'storage');

const MIN_BYTES = 5 * 1024;
const MAX_BYTES = 2 * 1024 * 1024;

export interface DecodedPhoto {
  buffer: Buffer;
  ext: 'jpg' | 'png';
}

/**
 * Mengubah foto base64 (boleh dengan awalan data URI) menjadi buffer,
 * dan memastikan isinya benar-benar JPEG/PNG berukuran wajar.
 */
export function decodePhoto(photoBase64: string): DecodedPhoto {
  const data = photoBase64.includes('base64,') ? photoBase64.split('base64,')[1] : photoBase64;
  const buffer = Buffer.from(data, 'base64');

  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isJpeg && !isPng) {
    throw new BadRequestException('Foto selfie harus berupa gambar JPEG atau PNG');
  }
  if (buffer.length < MIN_BYTES) {
    throw new BadRequestException('Foto selfie terlalu kecil atau rusak');
  }
  if (buffer.length > MAX_BYTES) {
    throw new BadRequestException('Ukuran foto selfie maksimal 2 MB');
  }
  return { buffer, ext: isJpeg ? 'jpg' : 'png' };
}

/** Simpan selfie absensi; mengembalikan path publik /uploads/attendance/<tanggal>/<uuid>.jpg */
export async function saveAttendancePhoto(photo: DecodedPhoto): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const dir = join(UPLOADS_ROOT, 'attendance', day);
  await mkdir(dir, { recursive: true });

  const fileName = `${randomUUID()}.${photo.ext}`;
  await writeFile(join(dir, fileName), photo.buffer);
  return `/uploads/attendance/${day}/${fileName}`;
}

/** Simpan foto acuan wajah di folder privat; mengembalikan path relatif terhadap storage/ */
export async function saveFaceReferencePhoto(employeeId: string, photo: DecodedPhoto): Promise<string> {
  const relDir = join('faces', employeeId);
  await mkdir(join(PRIVATE_STORAGE_ROOT, relDir), { recursive: true });

  const relPath = join(relDir, `${randomUUID()}.${photo.ext}`);
  await writeFile(join(PRIVATE_STORAGE_ROOT, relPath), photo.buffer);
  return relPath;
}
