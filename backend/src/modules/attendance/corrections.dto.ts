import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';
import { CorrectionType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateCorrectionDto {
  @IsUUID('4', { message: 'Karyawan tidak valid' })
  employeeId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal harus berformat YYYY-MM-DD' })
  date: string;

  @IsEnum(CorrectionType)
  type: CorrectionType;

  // Hanya untuk lupa absen masuk & pulang
  @ValidateIf((o) => o.type === CorrectionType.BOTH)
  @Matches(HH_MM, { message: 'Jam masuk harus HH:mm' })
  clockIn?: string;

  @Matches(HH_MM, { message: 'Jam pulang harus HH:mm' })
  clockOut: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  witness?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Alasan wajib diisi' })
  @MaxLength(500)
  reason: string;
}

export class DecideCorrectionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
