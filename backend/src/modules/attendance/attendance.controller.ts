import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ClockInDto, ClockOutDto } from './attendance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { scopedOutletId } from '../../common/utils/outlet-scope.util';

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Get('today')
  async getTodayStatus(@CurrentUser('id') userId: string) {
    return this.attendanceService.getTodayStatus(userId);
  }

  @Post('clock-in')
  async clockIn(@CurrentUser('id') userId: string, @Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(userId, dto);
  }

  @Post('clock-out')
  async clockOut(@CurrentUser('id') userId: string, @Body() dto: ClockOutDto) {
    return this.attendanceService.clockOut(userId, dto);
  }

  @Post('break/start')
  async startBreak(@CurrentUser('id') userId: string) {
    return this.attendanceService.startBreak(userId);
  }

  @Post('break/end')
  async endBreak(@CurrentUser('id') userId: string) {
    return this.attendanceService.endBreak(userId);
  }

  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.attendanceService.getHistory(
      userId,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.STORE_MANAGER, UserRole.AREA_MANAGER)
  @Get('admin/daily-report')
  async getDailyReport(
    @CurrentUser() user,
    @Query('outletId') outletId?: string,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.getAdminDailyReport(scopedOutletId(user, outletId), date);
  }
}
