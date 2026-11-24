import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrainingCategory, TrainingSessionMode, TrainingSessionStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class QuestionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Teks soal wajib diisi' })
  @MaxLength(500)
  prompt: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Setiap soal minimal 2 pilihan' })
  @ArrayMaxSize(5, { message: 'Setiap soal maksimal 5 pilihan' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Pilihan jawaban tidak boleh kosong' })
  @MaxLength(300, { each: true })
  options: string[];

  @IsInt()
  @Min(0)
  correctIndex: number;
}

class QuizContentDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal 1 soal' })
  @ArrayMaxSize(50, { message: 'Maksimal 50 soal' })
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  @IsOptional()
  questions?: QuestionDto[];

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  passingScore?: number;

  @IsArray()
  @IsUUID('4', { each: true, message: 'Jabatan sasaran tidak valid' })
  @IsOptional()
  targetPositionIds?: string[];
}

export class SaveModuleDto extends QuizContentDto {
  @Transform(trim)
  @Matches(/^[A-Z0-9-]{2,20}$/, { message: 'Kode modul 2–20 karakter: huruf besar, angka atau tanda minus' })
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Judul modul wajib diisi' })
  @MaxLength(200)
  title: string;

  @IsEnum(TrainingCategory, { message: 'Kategori tidak valid' })
  category: TrainingCategory;

  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'Isi materi wajib diisi' })
  @MaxLength(50000)
  content: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Tautan video harus alamat web lengkap (https://...)' })
  @IsOptional()
  videoUrl?: string | null;

  @IsBoolean()
  @IsOptional()
  isOnboarding?: boolean;
}

export class SaveWeeklyQuizDto extends QuizContentDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Judul kuis wajib diisi' })
  @MaxLength(200)
  title: string;

  @Matches(YMD, { message: 'Tanggal mulai harus berformat YYYY-MM-DD' })
  weekStart: string;

  @Matches(YMD, { message: 'Tenggat harus berformat YYYY-MM-DD' })
  deadline: string;
}

export class PublishDto {
  @IsBoolean()
  isPublished: boolean;
}

export class SubmitAnswersDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  answers: number[];
}

export class SaveSessionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Judul sesi wajib diisi' })
  @MaxLength(200)
  title: string;

  @IsUUID('4', { message: 'Modul tidak valid' })
  @IsOptional()
  moduleId?: string | null;

  @Matches(YMD, { message: 'Tanggal harus berformat YYYY-MM-DD' })
  date: string;

  @Matches(HHMM, { message: 'Jam mulai harus HH:mm' })
  startTime: string;

  @Matches(HHMM, { message: 'Jam selesai harus HH:mm' })
  endTime: string;

  @IsEnum(TrainingSessionMode, { message: 'Mode sesi tidak valid' })
  mode: TrainingSessionMode;

  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @IsOptional()
  location?: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value))
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Tautan rapat harus alamat web lengkap (https://...)' })
  @IsOptional()
  meetingUrl?: string | null;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama pelatih wajib diisi' })
  @MaxLength(100)
  trainerName: string;

  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID('4', { each: true, message: 'Peserta tidak valid' })
  participantIds: string[];
}

export class SessionStatusDto {
  @IsIn([TrainingSessionStatus.PLANNED, TrainingSessionStatus.DONE, TrainingSessionStatus.CANCELLED], { message: 'Status tidak valid' })
  status: TrainingSessionStatus;
}

class AttendanceEntryDto {
  @IsUUID('4')
  employeeId: string;

  @IsBoolean()
  attended: boolean;
}

export class AttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
}
