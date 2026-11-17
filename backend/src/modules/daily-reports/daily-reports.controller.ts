import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DailyReportsService } from './daily-reports.service';
import { SubmitDailyReportPhotoDto } from './daily-reports.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
@Controller('daily-reports')
export class DailyReportsController {
  constructor(private service: DailyReportsService) {}

  @Get('checklist')
  checklist() {
    return this.service.checklist();
  }

  @Get()
  forDate(@CurrentUser() user, @Query('date') date?: string, @Query('outletId') outletId?: string) {
    return this.service.forDate(user, date, outletId);
  }

  @Put(':date/:itemKey')
  submit(
    @CurrentUser() user,
    @Param('date') date: string,
    @Param('itemKey') itemKey: string,
    @Body() dto: SubmitDailyReportPhotoDto,
  ) {
    return this.service.submit(user, date, itemKey, dto);
  }
}
