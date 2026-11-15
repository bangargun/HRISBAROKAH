import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HH_MM_MESSAGE = 'Format jam harus HH:mm, misalnya 09:00';

export class CreateShiftDto {
  @IsUUID('4', { message: 'Outlet tidak valid' })
  outletId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nama shift wajib diisi' })
  @MaxLength(60)
  name: string;

  @Matches(HH_MM, { message: HH_MM_MESSAGE })
  startTime: string;

  @Matches(HH_MM, { message: HH_MM_MESSAGE })
  endTime: string;

  @IsInt()
  @Min(0)
  @Max(240, { message: 'Batas istirahat maksimal 240 menit' })
  @IsOptional()
  breakLimitMins?: number;
}

// Outlet sebuah shift tidak bisa dipindah; buat shift baru di outlet lain bila perlu
export class UpdateShiftDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama shift wajib diisi' })
  @MaxLength(60)
  @IsOptional()
  name?: string;

  @Matches(HH_MM, { message: HH_MM_MESSAGE })
  @IsOptional()
  startTime?: string;

  @Matches(HH_MM, { message: HH_MM_MESSAGE })
  @IsOptional()
  endTime?: string;

  @IsInt()
  @Min(0)
  @Max(240, { message: 'Batas istirahat maksimal 240 menit' })
  @IsOptional()
  breakLimitMins?: number;
}
