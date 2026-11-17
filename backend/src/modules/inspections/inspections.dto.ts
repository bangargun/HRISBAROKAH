import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { InspectionType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ScheduleInspectionDto {
  @IsUUID('4', { message: 'Cabang tidak valid' })
  outletId: string;

  @IsEnum(InspectionType)
  type: InspectionType;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal harus berformat YYYY-MM-DD' })
  scheduledDate: string;

  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @IsOptional()
  focusArea?: string;
}

export class InspectionResultDto {
  // Kunci titik checklist yang lolos; sisanya dianggap tidak lolos
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  passedItems: string[];

  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  findings?: string;

  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  actionItems?: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  branchManagerName?: string;
}
