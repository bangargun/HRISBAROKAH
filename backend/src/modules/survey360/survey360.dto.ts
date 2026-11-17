import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { SURVEY_360_QUESTIONS } from './survey360.questions';

export class SubmitSurvey360Dto {
  @IsUUID('4', { message: 'Rekan yang dinilai tidak valid' })
  targetId: string;

  @IsArray()
  @ArrayMinSize(SURVEY_360_QUESTIONS.length, { message: 'Semua pertanyaan wajib dijawab' })
  @ArrayMaxSize(SURVEY_360_QUESTIONS.length)
  @IsInt({ each: true })
  @Min(1, { each: true, message: 'Nilai 1-5' })
  @Max(5, { each: true, message: 'Nilai 1-5' })
  answers: number[];

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  @IsOptional()
  comment?: string;
}
