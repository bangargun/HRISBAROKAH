import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const MIN_BYTES = 5 * 1024;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Menyimpan foto selfie absensi (base64 JPEG/PNG) ke disk.
 * Deteksi wajah dilakukan di aplikasi mobile (ML Kit); server hanya memastikan
 * yang dikirim benar-benar file gambar, lalu menyimpannya sebagai bukti.
 * Mengembalikan path publik, misal /uploads/attendance/2026-11-01/<uuid>.jpg
 */
export async function saveAttendancePhoto(photoBase64: string): Promise<string> {
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

  const day = new Date().toISOString().slice(0, 10);
  const dir = join(UPLOADS_ROOT, 'attendance', day);
  await mkdir(dir, { recursive: true });

  const fileName = `${randomUUID()}.${isJpeg ? 'jpg' : 'png'}`;
  await writeFile(join(dir, fileName), buffer);

  return `/uploads/attendance/${day}/${fileName}`;
}
