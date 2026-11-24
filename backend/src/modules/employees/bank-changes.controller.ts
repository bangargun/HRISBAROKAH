import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { BankChangeStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { RejectBankChangeDto } from './profile.dto';

/** Persetujuan perubahan rekening gaji yang diajukan kru: hanya HR dan Super Admin. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
@Controller('bank-changes')
export class BankChangesController {
  constructor(private profile: ProfileService) {}

  @Get()
  list(@Query('status', new ParseEnumPipe(BankChangeStatus, { optional: true })) status?: BankChangeStatus) {
    return this.profile.list(status);
  }

  @Post(':id/approve')
  approve(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.profile.approve(userId, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: RejectBankChangeDto) {
    return this.profile.reject(userId, id, dto.note);
  }
}
