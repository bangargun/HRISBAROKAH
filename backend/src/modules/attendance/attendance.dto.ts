import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Base64 dari foto maksimal 2 MB (~2,7 juta karakter)
const MAX_PHOTO_BASE64_LENGTH = 3_000_000;

export class ClockInDto {
  @IsLatitude({ message: 'Latitude harus antara -90 dan 90' })
  @IsOptional()
  latitude?: number;

  @IsLongitude({ message: 'Longitude harus antara -180 dan 180' })
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsNotEmpty({ message: 'Foto selfie wajib disertakan untuk absen masuk' })
  @MaxLength(MAX_PHOTO_BASE64_LENGTH, { message: 'Ukuran foto selfie maksimal 2 MB' })
  photoBase64: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClockOutDto {
  @IsLatitude({ message: 'Latitude harus antara -90 dan 90' })
  @IsOptional()
  latitude?: number;

  @IsLongitude({ message: 'Longitude harus antara -180 dan 180' })
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsNotEmpty({ message: 'Foto selfie wajib disertakan untuk absen pulang' })
  @MaxLength(MAX_PHOTO_BASE64_LENGTH, { message: 'Ukuran foto selfie maksimal 2 MB' })
  photoBase64: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
