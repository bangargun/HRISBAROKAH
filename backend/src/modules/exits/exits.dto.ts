import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ExitReason, ExitType, RehireRecommendation, ResignNotice } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateExitDto {
  @IsUUID('4', { message: 'Karyawan tidak valid' })
  employeeId: string;

  @IsEnum(ExitType)
  type: ExitType;

  @Matches(YMD, { message: 'Tanggal pengajuan harus berformat YYYY-MM-DD' })
  submittedDate: string;

  @Matches(YMD, { message: 'Hari terakhir kerja harus berformat YYYY-MM-DD' })
  lastWorkingDate: string;

  @IsEnum(ResignNotice)
  @IsOptional()
  notice?: ResignNotice;

  @IsEnum(ExitReason)
  reason: ExitReason;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Keterangan wajib diisi' })
  @MaxLength(2000)
  reasonNotes: string;

  @IsEnum(RehireRecommendation)
  rehire: RehireRecommendation;
}

/** Perubahan selama proses keluar masih berjalan: serah terima, exit interview, koreksi data. */
export class UpdateExitDto {
  @Matches(YMD, { message: 'Hari terakhir kerja harus berformat YYYY-MM-DD' })
  @IsOptional()
  lastWorkingDate?: string;

  @IsEnum(ResignNotice)
  @IsOptional()
  notice?: ResignNotice;

  @IsEnum(ExitReason)
  @IsOptional()
  reason?: ExitReason;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Keterangan wajib diisi' })
  @MaxLength(2000)
  @IsOptional()
  reasonNotes?: string;

  @IsEnum(RehireRecommendation)
  @IsOptional()
  rehire?: RehireRecommendation;

  @IsBoolean()
  @IsOptional()
  uniformReturned?: boolean;

  @IsBoolean()
  @IsOptional()
  lockerCleared?: boolean;

  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  handoverNotes?: string;

  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  interviewNotes?: string;

  @IsInt() @Min(1) @Max(5) @IsOptional() ratingLeadership?: number;
  @IsInt() @Min(1) @Max(5) @IsOptional() ratingSchedule?: number;
  @IsInt() @Min(1) @Max(5) @IsOptional() ratingTeam?: number;
  @IsInt() @Min(1) @Max(5) @IsOptional() ratingTraining?: number;

  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  improvementSuggestion?: string;

  @IsBoolean()
  @IsOptional()
  wouldRecommend?: boolean;
}
