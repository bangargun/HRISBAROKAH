import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { LegalDocType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLegalDocDto {
  @IsEnum(LegalDocType, { message: 'Jenis surat tidak valid' })
  docType: LegalDocType;

  @IsUUID('4', { message: 'Karyawan tidak valid' })
  @IsOptional()
  employeeId?: string;

  @IsUUID('4', { message: 'Jabatan tujuan tidak valid' })
  @IsOptional()
  targetPositionId?: string;

  @IsUUID('4', { message: 'Cabang tujuan tidak valid' })
  @IsOptional()
  targetOutletId?: string;

  @Type(() => Number)
  @IsInt({ message: 'Nominal gaji harus angka bulat' })
  @Min(0)
  @IsOptional()
  salaryAmount?: number;

  @Transform(trim)
  @IsString()
  @MaxLength(300)
  @IsOptional()
  audience?: string;

  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @IsOptional()
  subject?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Judul surat wajib diisi' })
  @MaxLength(200)
  title: string;

  @Matches(YMD, { message: 'Tanggal berlaku harus berformat YYYY-MM-DD' })
  effectiveDate: string;

  @Matches(YMD, { message: 'Tanggal berakhir harus berformat YYYY-MM-DD' })
  @IsOptional()
  expiredDate?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama penanda tangan wajib diisi' })
  @MaxLength(100)
  signatoryName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Jabatan penanda tangan wajib diisi' })
  @MaxLength(100)
  signatoryRole: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Isi surat wajib diisi' })
  @MaxLength(20000)
  contentBody: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  considerations?: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  @IsOptional()
  decisions?: string[];
}

export class CancelLegalDocDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Alasan pembatalan wajib diisi' })
  @MaxLength(500)
  reason: string;
}
