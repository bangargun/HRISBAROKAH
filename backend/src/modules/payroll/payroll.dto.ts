import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class PayrollPeriodDto {
  @IsUUID('4', { message: 'Cabang tidak valid' })
  outletId: string;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Bulan harus 1-12' })
  @Max(12, { message: 'Bulan harus 1-12' })
  month: number;
}

const money = { message: 'Nominal harus angka 0 atau lebih' };

export class UpdatePayrollSettingsDto {
  @IsNumber() @Min(0, money) @IsOptional() basicSalaryProbation?: number;
  @IsNumber() @Min(0, money) @IsOptional() basicSalaryRegular?: number;
  @IsInt() @Min(0) @Max(24) @IsOptional() probationMonths?: number;
  @IsNumber() @Min(0, money) @IsOptional() mealAllowancePerDay?: number;
  @IsNumber() @Min(0, money) @IsOptional() latePenaltyPerMinute?: number;
  @IsNumber() @Min(0, money) @IsOptional() tenureAllowanceMonth7?: number;
  @IsNumber() @Min(0, money) @IsOptional() tenureAllowanceMonth13?: number;
  @IsNumber() @Min(0, money) @IsOptional() tenureAllowanceMonth19?: number;
  @IsNumber() @Min(0, money) @IsOptional() tenureAllowanceStep?: number;
  @IsInt() @Min(0) @Max(100, { message: 'Batas kasbon 0-100%' }) @IsOptional() kasbonMaxPercent?: number;
  @IsNumber() @Min(0, money) @IsOptional() kpiIncentiveGradeA?: number;
}
