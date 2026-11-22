import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreatePairingDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama tablet wajib diisi' })
  @MaxLength(40, { message: 'Nama tablet maksimal 40 karakter' })
  deviceName: string;
}

export class PairDeviceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'Kode tidak berlaku' })
  @IsNotEmpty({ message: 'Kode tidak berlaku' })
  @MaxLength(32, { message: 'Kode tidak berlaku' })
  code: string;
}
