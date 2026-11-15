import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// Kosong berarti menghapus BSSID
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim().toUpperCase() : value;

const BSSID = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const BSSID_MESSAGE = 'BSSID Wi-Fi harus berformat AA:BB:CC:DD:EE:FF';

export class CreateOutletDto {
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

  @IsInt()
  @Min(10, { message: 'Radius minimal 10 meter' })
  @Max(1000, { message: 'Radius maksimal 1000 meter' })
  @IsOptional()
  geofenceRadius?: number;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(BSSID, { message: BSSID_MESSAGE })
  @IsOptional()
  wifiBssid?: string | null;

  @IsInt()
  @Min(1, { message: 'Tanggal tutup buku 1-31' })
  @Max(31, { message: 'Tanggal tutup buku 1-31' })
  @IsOptional()
  payrollCutoffDay?: number;
}

// Kode cabang tidak bisa diubah karena dipakai sebagai acuan di laporan
export class UpdateOutletDto {
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

  @IsInt()
  @Min(10, { message: 'Radius minimal 10 meter' })
  @Max(1000, { message: 'Radius maksimal 1000 meter' })
  @IsOptional()
  geofenceRadius?: number;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(BSSID, { message: BSSID_MESSAGE })
  @IsOptional()
  wifiBssid?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(1, { message: 'Tanggal tutup buku 1-31' })
  @Max(31, { message: 'Tanggal tutup buku 1-31' })
  @IsOptional()
  payrollCutoffDay?: number;
}
