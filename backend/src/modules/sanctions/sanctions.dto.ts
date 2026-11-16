import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { SanctionType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateSanctionDto {
  @IsUUID('4', { message: 'Karyawan tidak valid' })
  employeeId: string;

  @IsEnum(SanctionType)
  type: SanctionType;

  @Matches(YMD, { message: 'Tanggal kejadian harus berformat YYYY-MM-DD' })
  incidentDate: string;

  @Matches(YMD, { message: 'Berlaku sampai harus berformat YYYY-MM-DD' })
  validUntil: string;

  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  category?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Uraian pelanggaran wajib diisi' })
  @MaxLength(2000)
  violationDesc: string;

  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  actionTaken?: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  witness?: string;
}
