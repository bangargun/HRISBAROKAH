import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
import { EmploymentStatus, UserRole } from '@prisma/client';

export class CreateEmployeeDto {
  // Akun User
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9._-]{3,30}$/, { message: 'Username 3-30 karakter: huruf kecil, angka, titik, garis bawah atau tanda hubung' })
  username: string;

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @MaxLength(72)
  password: string;

  @IsString()
  @IsOptional()
  email?: string;

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

  @Matches(DATE_PREFIX, { message: 'Tanggal lahir harus berformat YYYY-MM-DD' })
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @IsString()
  @IsOptional()
  bankAccountHolder?: string;
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

  @IsString()
  @MaxLength(60)
  @IsOptional()
  bankName?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  bankAccountNumber?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  bankAccountHolder?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  @MaxLength(72)
  newPassword: string;
}

export class SetActiveDto {
  @IsBoolean()
  isActive: boolean;
}
