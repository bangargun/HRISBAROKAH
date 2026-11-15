import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID, Matches, ValidateIf, ValidateNested } from 'class-validator';

export class ScheduleEntryDto {
  @IsUUID('4', { message: 'Karyawan tidak valid' })
  employeeId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal harus berformat YYYY-MM-DD' })
  date: string;

  /** null = libur (jadwal pada tanggal itu dihapus) */
  @ValidateIf((o) => o.shiftId !== null)
  @IsUUID('4', { message: 'Shift tidak valid' })
  shiftId: string | null;
}

export class SaveSchedulesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Tidak ada jadwal yang disimpan' })
  @ArrayMaxSize(500, { message: 'Maksimal 500 sel jadwal sekali simpan' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleEntryDto)
  entries: ScheduleEntryDto[];
}
