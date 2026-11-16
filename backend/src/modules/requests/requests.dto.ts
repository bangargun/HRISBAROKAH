import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsInt,
  IsPositive,
  Matches,
  Max,
  IsString,
  Min,
} from 'class-validator';
import { RequestType } from '@prisma/client';

// Batas teknis agar nominal tidak melampaui kolom database; batas kebijakan diatur lewat persetujuan
const MAX_KASBON_AMOUNT = 100_000_000;
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}(T.*)?$/;

export class CreateKasbonDto {
  @IsNumber()
  @IsPositive({ message: 'Nominal kasbon harus lebih dari 0' })
  @Max(MAX_KASBON_AMOUNT, { message: 'Nominal kasbon maksimal Rp 100.000.000' })
  amount: number;

  @IsInt({ message: 'Tenor cicilan harus bilangan bulat (bulan)' })
  @Min(1, { message: 'Tenor cicilan minimal 1 bulan' })
  @Max(24, { message: 'Tenor cicilan maksimal 24 bulan' })
  @IsOptional()
  tenorMonths?: number;

  @IsString()
  @IsNotEmpty({ message: 'Alasan darurat kasbon wajib diisi' })
  reason: string;
}

export class CreateGeneralRequestDto {
  @IsEnum(RequestType)
  type: RequestType;

  // YYYY-MM-DD atau ISO datetime; yang dipakai hanya bagian tanggalnya.
  // Wajib: cuti, izin, sakit, lembur dan tukar shift selalu untuk tanggal tertentu.
  @Matches(DATE_PREFIX, { message: 'Tanggal mulai harus berformat YYYY-MM-DD' })
  startDate: string;

  @Matches(DATE_PREFIX, { message: 'Tanggal selesai harus berformat YYYY-MM-DD' })
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsNotEmpty({ message: 'Keterangan pengajuan wajib diisi' })
  reason: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @IsString()
  @IsOptional()
  targetEmployeeId?: string; // Khusus tukar shift
}

export class ApprovalActionDto {
  @IsIn(['APPROVE', 'REJECT'], { message: 'Aksi harus APPROVE atau REJECT' })
  action: 'APPROVE' | 'REJECT';

  @IsString()
  @IsOptional()
  notes?: string;
}
