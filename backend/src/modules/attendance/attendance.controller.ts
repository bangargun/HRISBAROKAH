import { Controller, Post, Get, GoneException, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
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

  /**
   * Absen dari HP sudah ditutup: absen hanya lewat tablet cabang. Rute lama tetap menjawab
   * dengan pesan jelas supaya aplikasi HP versi lama tidak menampilkan galat yang membingungkan.
   */
  @Post(['clock-in', 'clock-out', 'break/start', 'break/end'])
  phoneAttendanceClosed() {
    throw new GoneException('Absen hanya lewat tablet cabang');
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
