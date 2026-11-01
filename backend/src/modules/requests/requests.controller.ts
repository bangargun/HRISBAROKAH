import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateKasbonDto, CreateGeneralRequestDto, ApprovalActionDto } from './requests.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestStatus, RequestType, UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private requestsService: RequestsService) {}

  @Post('kasbon')
  async createKasbon(@CurrentUser('id') userId: string, @Body() dto: CreateKasbonDto) {
    return this.requestsService.createKasbon(userId, dto);
  }

  @Post('general')
  async createGeneralRequest(@CurrentUser('id') userId: string, @Body() dto: CreateGeneralRequestDto) {
    return this.requestsService.createGeneralRequest(userId, dto);
  }

  @Get('my')
  async getMyRequests(@CurrentUser('id') userId: string) {
    return this.requestsService.getMyRequests(userId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN, UserRole.STORE_MANAGER, UserRole.AREA_MANAGER)
  @Get('admin')
  async getAdminRequests(
    @Query('outletId') outletId?: string,
    @Query('status') status?: RequestStatus,
    @Query('type') type?: RequestType,
  ) {
    return this.requestsService.getAdminRequests(outletId, status, type);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.STORE_MANAGER, UserRole.AREA_MANAGER)
  @Patch(':id/store-manager-review')
  async reviewByStoreManager(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.requestsService.approveOrRejectByStoreManager(id, reviewerId, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN)
  @Patch(':id/hr-review')
  async reviewByHr(
    @Param('id') id: string,
    @CurrentUser('id') hrUserId: string,
    @Body() dto: ApprovalActionDto,
  ) {
    return this.requestsService.approveOrRejectByHr(id, hrUserId, dto);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  @Patch(':id/disburse-kasbon')
  async disburseKasbon(@Param('id') id: string) {
    return this.requestsService.disburseKasbon(id);
  }
}
