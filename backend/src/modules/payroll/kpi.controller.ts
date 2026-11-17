import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, assertOutletAccess } from '../../common/utils/outlet-scope.util';
import { PayrollService } from './payroll.service';
import { PayrollPeriodDto } from './payroll.dto';

/** KPI kru per cabang dan periode gaji. Kepala cabang hanya cabangnya sendiri. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
@Controller('kpi')
export class KpiController {
  constructor(private payrollService: PayrollService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() dto: PayrollPeriodDto) {
    assertOutletAccess(user, dto.outletId, 'Anda hanya bisa melihat KPI cabang Anda');
    return this.payrollService.kpi(dto);
  }
}
