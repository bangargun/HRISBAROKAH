import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { GENDERS } from './employees.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Data diri yang diisi kru sendiri dari aplikasi HP; data kepegawaian tetap milik HR. */
export class UpdateMyProfileDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nomor HP wajib diisi' })
  @MaxLength(20)
  phone: string;

  // Kosong = hapus email
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() || null : value))
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsOptional()
  email?: string | null;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal lahir harus berformat YYYY-MM-DD' })
  birthDate: string;

  @IsIn(GENDERS, { message: 'Pilih jenis kelamin' })
  gender: string;

  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Alamat terlalu pendek' })
  @MaxLength(300)
  address: string;
}

export class BankChangeDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama bank wajib diisi' })
  @MaxLength(60)
  bankName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s.-]/g, '') : value))
  @Matches(/^\d{5,30}$/, { message: 'Nomor rekening 5-30 digit angka' })
  bankAccountNumber: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama pemilik rekening wajib diisi' })
  @MaxLength(100)
  bankAccountHolder: string;
}

export class RejectBankChangeDto {
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Tulis alasan penolakan (minimal 5 karakter)' })
  @MaxLength(300)
  note: string;
}
