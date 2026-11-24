import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEmail,
  IsIn,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { EmployeeDocumentType, EmploymentStatus, UserRole } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Teks kosong dari form = hapus isian (null), bukan simpan string kosong. */
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
/** Nilai jenis kelamin yang disimpan (sama dengan tampilan lama di web). */
export const GENDERS = ['Laki-laki', 'Perempuan'] as const;

export class CreateEmployeeDto {
  // Akun User
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9._-]{3,30}$/, { message: 'Username 3-30 karakter: huruf kecil, angka, titik, garis bawah atau tanda hubung' })
  username: string;

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @MaxLength(72)
  password: string;

  @Transform(emptyToNull)
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsOptional()
  email?: string | null;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  // Profil Karyawan
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'NIK wajib diisi' })
  @MaxLength(30)
  nik: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @MaxLength(100)
  fullName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nomor HP wajib diisi' })
  @MaxLength(20)
  phone: string;

  @IsUUID('4', { message: 'Cabang tidak valid' })
  outletId: string;

  @IsUUID('4', { message: 'Jabatan tidak valid' })
  positionId: string;

  @IsEnum(EmploymentStatus)
  @IsOptional()
  status?: EmploymentStatus;

  @Matches(DATE_PREFIX, { message: 'Tanggal masuk harus berformat YYYY-MM-DD' })
  joinDate: string;

  @Transform(emptyToNull)
  @Matches(DATE_PREFIX, { message: 'Tanggal lahir harus berformat YYYY-MM-DD' })
  @IsOptional()
  birthDate?: string | null;

  @Transform(emptyToNull)
  @IsIn(GENDERS, { message: 'Jenis kelamin: Laki-laki atau Perempuan' })
  @IsOptional()
  gender?: string | null;

  @Transform(emptyToNull)
  @IsString()
  @MaxLength(300)
  @IsOptional()
  address?: string | null;

  @Transform(emptyToNull)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  bankName?: string | null;

  @Transform(emptyToNull)
  @Matches(/^\d{5,30}$/, { message: 'Nomor rekening 5-30 digit angka' })
  @IsOptional()
  bankAccountNumber?: string | null;

  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  bankAccountHolder?: string | null;
}

export class UpdateEmployeeDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @MaxLength(100)
  @IsOptional()
  fullName?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'NIK wajib diisi' })
  @MaxLength(30)
  @IsOptional()
  nik?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nomor HP wajib diisi' })
  @MaxLength(20)
  @IsOptional()
  phone?: string;

  @IsUUID('4', { message: 'Cabang tidak valid' })
  @IsOptional()
  outletId?: string;

  @IsUUID('4', { message: 'Jabatan tidak valid' })
  @IsOptional()
  positionId?: string;

  @IsEnum(EmploymentStatus)
  @IsOptional()
  status?: EmploymentStatus;

  @Matches(DATE_PREFIX, { message: 'Tanggal masuk harus berformat YYYY-MM-DD' })
  @IsOptional()
  joinDate?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  // Data pribadi; teks kosong = dikosongkan
  @Transform(emptyToNull)
  @Matches(DATE_PREFIX, { message: 'Tanggal lahir harus berformat YYYY-MM-DD' })
  @IsOptional()
  birthDate?: string | null;

  @Transform(emptyToNull)
  @IsIn(GENDERS, { message: 'Jenis kelamin: Laki-laki atau Perempuan' })
  @IsOptional()
  gender?: string | null;

  @Transform(emptyToNull)
  @IsString()
  @MaxLength(300)
  @IsOptional()
  address?: string | null;

  @Transform(emptyToNull)
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsOptional()
  email?: string | null;

  @Transform(emptyToNull)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  bankName?: string | null;

  @Transform(emptyToNull)
  @Matches(/^\d{5,30}$/, { message: 'Nomor rekening 5-30 digit angka' })
  @IsOptional()
  bankAccountNumber?: string | null;

  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  bankAccountHolder?: string | null;
}

/** Satu baris Excel impor karyawan; semua teks, diperiksa di service. */
export class ImportEmployeeRow {
  @IsString() @IsOptional() fullName?: string;
  @IsString() @IsOptional() nik?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() outlet?: string;
  @IsString() @IsOptional() position?: string;
  @IsString() @IsOptional() joinDate?: string;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() username?: string;
  @IsString() @IsOptional() password?: string;
  @IsString() @IsOptional() birthDate?: string;
  @IsString() @IsOptional() gender?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() bankName?: string;
  @IsString() @IsOptional() bankAccountNumber?: string;
  @IsString() @IsOptional() bankAccountHolder?: string;
  /** Nomor baris di Excel, agar laporan kesalahan menunjuk baris yang benar */
  @IsInt() @Min(2) @IsOptional() excelRow?: number;
}

export class ImportEmployeesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'File tidak berisi data karyawan' })
  @ArrayMaxSize(500, { message: 'Maksimal 500 karyawan per impor' })
  @ValidateNested({ each: true })
  @Type(() => ImportEmployeeRow)
  rows: ImportEmployeeRow[];

  @IsBoolean()
  dryRun: boolean;
}

export class UploadDocumentDto {
  @IsEnum(EmployeeDocumentType, { message: 'Jenis dokumen tidak valid' })
  type: EmployeeDocumentType;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  note?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @MaxLength(72)
  newPassword: string;
}

export class SetAttendancePinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN harus 6 digit angka' })
  pin: string;
}

export class SetActiveDto {
  @IsBoolean()
  isActive: boolean;
}
