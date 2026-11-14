import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { RequestType } from '@prisma/client';

export class CreateKasbonDto {
  @IsNumber()
  @IsPositive({ message: 'Nominal kasbon harus lebih dari 0' })
  amount: number;

  @IsNumber()
  @Min(1, { message: 'Tenor cicilan minimal 1 bulan' })
  @IsOptional()
  tenorMonths?: number;

  @IsString()
  @IsNotEmpty({ message: 'Alasan darurat kasbon wajib diisi' })
  reason: string;
}

export class CreateGeneralRequestDto {
  @IsEnum(RequestType)
  type: RequestType;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
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
