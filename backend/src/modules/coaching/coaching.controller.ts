import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CoachingService } from './coaching.service';
import { CreateCoachingDto, SetCoachingStatusDto, UpdateCoachingDto } from './coaching.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER)
@Controller('coaching')
export class CoachingController {
  constructor(private service: CoachingService) {}

  @Get()
  list(@CurrentUser() user, @Query('outletId') outletId?: string, @Query('status') status?: string) {
    return this.service.list(user, outletId, status);
  }

  @Get('coaches')
  coaches(@CurrentUser() user) {
    return this.service.coaches(user);
  }

  @Post()
  create(@CurrentUser() user, @Body() dto: CreateCoachingDto) {
    return this.service.create(user, dto);
  }

  @Put(':id')
  update(@CurrentUser() user, @Param('id') id: string, @Body() dto: UpdateCoachingDto) {
    return this.service.update(user, id, dto);
  }

  @Patch(':id/status')
  setStatus(@CurrentUser() user, @Param('id') id: string, @Body() dto: SetCoachingStatusDto) {
    return this.service.setStatus(user, id, dto);
  }
}
