import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsUUID, Matches, ValidateNested } from 'class-validator';

export class ScheduleEntryDto {
  @IsUUID('4', { message: 'Karyawan tidak valid' })
  employeeId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal harus berformat YYYY-MM-DD' })
  date: string;

  /** true = masuk (jam dari jam kerja cabang), false = libur */
  @IsBoolean({ message: 'Isi working dengan true (masuk) atau false (libur)' })
  working: boolean;
}

export class SaveSchedulesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Tidak ada jadwal yang disimpan' })
  @ArrayMaxSize(500, { message: 'Maksimal 500 sel jadwal sekali simpan' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleEntryDto)
  entries: ScheduleEntryDto[];
}
