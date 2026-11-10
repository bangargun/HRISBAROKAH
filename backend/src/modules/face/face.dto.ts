import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsBoolean, IsString, MaxLength } from 'class-validator';

// Base64 dari foto maksimal 2 MB (~2,7 juta karakter)
const MAX_PHOTO_BASE64_LENGTH = 3_000_000;

export const MIN_ENROLL_PHOTOS = 3;
export const MAX_ENROLL_PHOTOS = 5;

export class EnrollFaceDto {
  @IsArray()
  @ArrayMinSize(MIN_ENROLL_PHOTOS, {
    message: `Minimal ${MIN_ENROLL_PHOTOS} foto wajah`,
  })
  @ArrayMaxSize(MAX_ENROLL_PHOTOS, {
    message: `Maksimal ${MAX_ENROLL_PHOTOS} foto wajah`,
  })
  @IsString({ each: true })
  @MaxLength(MAX_PHOTO_BASE64_LENGTH, {
    each: true,
    message: 'Ukuran tiap foto maksimal 2 MB',
  })
  photosBase64: string[];

  @IsBoolean()
  @Equals(true, {
    message: 'Persetujuan tertulis karyawan atas data wajah wajib dikonfirmasi',
  })
  consentConfirmed: boolean;
}
