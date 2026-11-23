import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LegalDocsService } from './legal-docs.service';
import { CancelLegalDocDto, CreateLegalDocDto } from './legal-docs.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('legal-docs')
export class LegalDocsController {
  constructor(private service: LegalDocsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
  @Get()
  list(@CurrentUser() user, @Query('category') category?: string, @Query('outletId') outletId?: string) {
    return this.service.list(user, category, outletId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post()
  create(@CurrentUser() user, @Body() dto: CreateLegalDocDto) {
    return this.service.create(user, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post(':id/apply')
  apply(@CurrentUser() user, @Param('id') id: string) {
    return this.service.apply(user, id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
  @Post(':id/cancel')
  cancel(@CurrentUser() user, @Param('id') id: string, @Body() dto: CancelLegalDocDto) {
    return this.service.cancel(user, id, dto);
  }
}
