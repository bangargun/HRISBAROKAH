import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const MAX_PHOTO_BASE64_LENGTH = 3_000_000;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SubmitDailyReportPhotoDto {
  @IsString()
  @IsNotEmpty({ message: 'Foto wajib disertakan' })
  @MaxLength(MAX_PHOTO_BASE64_LENGTH, { message: 'Ukuran foto maksimal 2 MB' })
  photoBase64: string;

  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;

  // Kepala cabang selalu cabangnya sendiri; HR/Area memilih cabang
  @IsUUID('4', { message: 'Cabang tidak valid' })
  @IsOptional()
  outletId?: string;
}
