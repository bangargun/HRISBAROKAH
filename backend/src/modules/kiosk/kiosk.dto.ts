import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { KioskEventType, KioskMethod } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePairingDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama tablet wajib diisi' })
  @MaxLength(40, { message: 'Nama tablet maksimal 40 karakter' })
  deviceName: string;
}

export class PairDeviceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Kode tidak berlaku' })
  @IsNotEmpty({ message: 'Kode tidak berlaku' })
  @MaxLength(32, { message: 'Kode tidak berlaku' })
  code: string;
}

// Foto absen tablet: JPEG sisi terpanjang 480 px (biasanya < 100 KB). 50 event x foto
// terbesar (180 ribu karakter) ~ 9 MB, muat di batas body rute ini (10 MB, sama dengan
// client_max_body_size Nginx).
export const MAX_KIOSK_PHOTO_BASE64_LENGTH = 180_000;
export const MAX_KIOSK_EVENTS_PER_BATCH = 50;
export const KIOSK_EVENTS_BODY_LIMIT = '10mb';

export class KioskEventDto {
  @IsUUID('all', { message: 'id event harus UUID' })
  id: string;

  @IsUUID('all', { message: 'employeeId harus UUID' })
  employeeId: string;

  @IsEnum(KioskEventType, { message: 'Jenis event tidak dikenal' })
  type: KioskEventType;

  @IsEnum(KioskMethod, { message: 'Metode absen tidak dikenal' })
  method: KioskMethod;

  @IsISO8601({ strict: true }, { message: 'deviceTime harus waktu ISO 8601' })
  deviceTime: string;

  @IsInt({ message: 'offsetAtEventMs harus bilangan bulat' })
  offsetAtEventMs: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  localScore?: number;

  @IsString()
  @IsNotEmpty({ message: 'Foto absen wajib disertakan' })
  @MaxLength(MAX_KIOSK_PHOTO_BASE64_LENGTH, { message: 'Ukuran foto absen terlalu besar' })
  photoBase64: string;

  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'PIN harus 6 digit angka' })
  pin?: string;

  // Tablet melihat jamnya mundur / tidak cocok dengan jam monoton saat event dibuat
  @IsOptional()
  @IsBoolean({ message: 'clockSuspect harus boolean' })
  clockSuspect?: boolean;
}

export class KioskEventsDto {
  @IsISO8601({ strict: true }, { message: 'deviceNow harus waktu ISO 8601' })
  deviceNow: string;

  // Selisih jam server - jam tablet yang diukur tablet (GET /kiosk/time) tepat sebelum batch ini.
  // Dipakai bila ada: deviceNow dicap sebelum unggahan yang bisa lama (Nginx menampung body).
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'offsetNowMs harus angka' })
  offsetNowMs?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal 1 event' })
  @ArrayMaxSize(MAX_KIOSK_EVENTS_PER_BATCH, { message: `Maksimal ${MAX_KIOSK_EVENTS_PER_BATCH} event per kiriman` })
  @ValidateNested({ each: true })
  @Type(() => KioskEventDto)
  events: KioskEventDto[];
}

export class IdentifyDto {
  @IsString()
  @IsNotEmpty({ message: 'Foto wajib disertakan' })
  @MaxLength(MAX_KIOSK_PHOTO_BASE64_LENGTH, { message: 'Ukuran foto terlalu besar' })
  photoBase64: string;
}
