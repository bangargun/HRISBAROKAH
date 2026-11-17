import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PayrollPeriodDto } from '../payroll/payroll.dto';
import { Survey360Service } from './survey360.service';
import { SubmitSurvey360Dto } from './survey360.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('survey360')
export class Survey360Controller {
  constructor(private service: Survey360Service) {}

  @Get('questions')
  questions() {
    return this.service.questions();
  }

  // Semua karyawan (aplikasi HP) menilai rekan satu cabang
  @Get('mine')
  mine(@CurrentUser('id') userId: string) {
    return this.service.mine(userId);
  }

  @Post()
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitSurvey360Dto) {
    return this.service.submit(userId, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get('results')
  results(@CurrentUser() user, @Query() dto: PayrollPeriodDto) {
    return this.service.results(user, dto.outletId, dto.year, dto.month);
  }
}
