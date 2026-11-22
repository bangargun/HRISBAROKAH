import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AttendanceMode } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// String kosong berarti "kosongkan" (null)
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HH_MM_MESSAGE = 'Format jam harus HH:mm, misalnya 09:00';
const BSSID = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

/** Isian cabang yang sama untuk tambah dan ubah (lihat form Daftar Cabang). */
class OutletFieldsDto {
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  brand?: string | null;

  @Transform(emptyToNull)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  city?: string | null;

  @IsInt()
  @Min(10, { message: 'Radius minimal 10 meter' })
  @Max(1000, { message: 'Radius maksimal 1000 meter' })
  @IsOptional()
  geofenceRadius?: number;

  @Transform(({ value }) => (typeof value === 'string' ? (value.trim() === '' ? null : value.trim().toUpperCase()) : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(BSSID, { message: 'BSSID Wi-Fi harus berformat AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  wifiBssid?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID('4', { message: 'Kepala cabang tidak valid' })
  @IsOptional()
  managerId?: string | null;

  @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() weekdayWorkStart?: string;
  @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() weekdayWorkEnd?: string;
  @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() weekendWorkStart?: string;
  @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() weekendWorkEnd?: string;
  @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() holidayWorkStart?: string;
  @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() holidayWorkEnd?: string;

  @Transform(emptyToNull) @ValidateIf((_, v) => v !== null && v !== undefined) @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() weekdayOpen?: string | null;
  @Transform(emptyToNull) @ValidateIf((_, v) => v !== null && v !== undefined) @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() weekdayClose?: string | null;
  @Transform(emptyToNull) @ValidateIf((_, v) => v !== null && v !== undefined) @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() weekendOpen?: string | null;
  @Transform(emptyToNull) @ValidateIf((_, v) => v !== null && v !== undefined) @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() weekendClose?: string | null;
  @Transform(emptyToNull) @ValidateIf((_, v) => v !== null && v !== undefined) @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() holidayOpen?: string | null;
  @Transform(emptyToNull) @ValidateIf((_, v) => v !== null && v !== undefined) @Matches(HH_MM, { message: HH_MM_MESSAGE }) @IsOptional() holidayClose?: string | null;

  @IsEnum(AttendanceMode, { message: 'Mode absensi harus MOBILE atau TABLET' })
  @IsOptional()
  attendanceMode?: AttendanceMode;

  @IsInt()
  @Min(0)
  @Max(240, { message: 'Batas istirahat maksimal 240 menit' })
  @IsOptional()
  breakLimitMins?: number;

  @IsInt()
  @Min(1, { message: 'Tanggal tutup buku 1-31' })
  @Max(31, { message: 'Tanggal tutup buku 1-31' })
  @IsOptional()
  payrollCutoffDay?: number;

  @IsInt()
  @Min(1, { message: 'Tanggal gajian 1-31' })
  @Max(31, { message: 'Tanggal gajian 1-31' })
  @IsOptional()
  paydayDay?: number;
}

export class CreateOutletDto extends OutletFieldsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9-]{2,30}$/, { message: 'Kode cabang 2-30 karakter: huruf, angka atau tanda hubung' })
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama cabang wajib diisi' })
  @MaxLength(100)
  name: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Alamat cabang wajib diisi' })
  @MaxLength(300)
  address: string;

  @IsLatitude({ message: 'Latitude harus antara -90 dan 90' })
  latitude: number;

  @IsLongitude({ message: 'Longitude harus antara -180 dan 180' })
  longitude: number;
}

// Kode cabang tidak bisa diubah karena dipakai sebagai acuan di laporan
export class UpdateOutletDto extends OutletFieldsDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama cabang wajib diisi' })
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Alamat cabang wajib diisi' })
  @MaxLength(300)
  @IsOptional()
  address?: string;

  @IsLatitude({ message: 'Latitude harus antara -90 dan 90' })
  @IsOptional()
  latitude?: number;

  @IsLongitude({ message: 'Longitude harus antara -180 dan 180' })
  @IsOptional()
  longitude?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
