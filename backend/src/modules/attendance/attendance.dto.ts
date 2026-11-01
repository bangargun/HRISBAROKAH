import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ClockInDto {
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsNotEmpty({ message: 'Foto selfie kontur wajah wajib disertakan untuk verifikasi biometrik' })
  photoUrl: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClockOutDto {
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsNotEmpty({ message: 'Foto selfie kontur wajah kepulangan wajib disertakan' })
  photoUrl: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
