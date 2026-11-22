import { Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReviewService } from './review.service';

/** Tinjauan absen tablet yang meragukan (HR, Super Admin; Store Manager hanya outletnya). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.STORE_MANAGER)
@Controller('attendance-review')
export class ReviewController {
  constructor(private review: ReviewService) {}

  @Get()
  list(
    @CurrentUser() user,
    @Query('status') status?: string,
    @Query('outletId') outletId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.review.list(user, { status, outletId, from, to });
  }

  @Get(':id/enrolled-photo')
  async enrolledPhoto(@CurrentUser() user, @Param('id') id: string, @Res() res: Response) {
    const file = await this.review.enrolledPhotoFile(user, id);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(file);
  }

  @Post(':id/accept')
  accept(@CurrentUser() user, @Param('id') id: string) {
    return this.review.accept(user, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user, @Param('id') id: string) {
    return this.review.reject(user, id);
  }
}
