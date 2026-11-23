import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { CoachingPriority, CoachingStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCoachingDto {
  @IsUUID('4', { message: 'Karyawan tidak valid' })
  employeeId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Agenda pendampingan wajib diisi' })
  @MaxLength(200)
  topic: string;

  @Matches(YMD, { message: 'Tanggal sesi harus berformat YYYY-MM-DD' })
  scheduledDate: string;

  @IsEnum(CoachingPriority, { message: 'Prioritas tidak valid' })
  priority: CoachingPriority;

  @IsUUID('4', { message: 'Pendamping tidak valid' })
  @IsOptional()
  coachId?: string;
}

export class UpdateCoachingDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Agenda pendampingan wajib diisi' })
  @MaxLength(200)
  topic: string;

  @Matches(YMD, { message: 'Tanggal sesi harus berformat YYYY-MM-DD' })
  scheduledDate: string;

  @IsEnum(CoachingPriority, { message: 'Prioritas tidak valid' })
  priority: CoachingPriority;

  @IsUUID('4', { message: 'Pendamping tidak valid' })
  coachId: string;
}

export class SetCoachingStatusDto {
  @IsIn([CoachingStatus.IN_PROGRESS, CoachingStatus.DONE, CoachingStatus.CANCELLED], { message: 'Status tidak valid' })
  status: CoachingStatus;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Catatan hasil minimal 10 karakter' })
  @MaxLength(2000)
  @IsOptional()
  resultNote?: string;
}
