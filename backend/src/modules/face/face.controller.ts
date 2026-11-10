import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FaceEnrollmentService } from './face-enrollment.service';
import { EnrollFaceDto } from './face.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('face')
export class FaceController {
  constructor(private enrollment: FaceEnrollmentService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get('employees/:id')
  async getStatus(@CurrentUser() user, @Param('id') employeeId: string) {
    return this.enrollment.getStatus(user, employeeId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Post('employees/:id')
  async enroll(@CurrentUser() user, @Param('id') employeeId: string, @Body() dto: EnrollFaceDto) {
    return this.enrollment.enroll(user, employeeId, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Delete('employees/:id')
  async remove(@CurrentUser() user, @Param('id') employeeId: string) {
    return this.enrollment.remove(user, employeeId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get('checks')
  async getChecks(
    @CurrentUser() user,
    @Query('outletId') outletId?: string,
    @Query('date') date?: string,
    @Query('onlyRejected') onlyRejected?: string,
  ) {
    return this.enrollment.getCheckLogs(user, outletId, date, onlyRejected === 'true');
  }
}
