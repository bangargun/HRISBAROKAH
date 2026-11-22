import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Username atau NIK tidak boleh kosong' })
  username: string;

  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @MinLength(6, { message: 'Password baru minimal 6 karakter' })
  @MaxLength(72)
  newPassword: string;
}

export class ChangeUsernameDto {
  @IsString()
  @IsNotEmpty({ message: 'Masukkan password saat ini' })
  password: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9._-]{3,30}$/, { message: 'Username 3-30 karakter: huruf kecil, angka, titik, garis bawah atau tanda hubung' })
  newUsername: string;
}

export class SetAttendancePinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN harus 6 digit angka' })
  pin: string;

  @IsString()
  @IsNotEmpty({ message: 'Masukkan password akun' })
  password: string;
}

export class UpdateFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
