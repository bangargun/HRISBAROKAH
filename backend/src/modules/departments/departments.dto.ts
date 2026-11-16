import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

export class NameDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Nama wajib diisi' })
  @MaxLength(60)
  name: string;
}
