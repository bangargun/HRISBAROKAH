import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { BankChangeDto, UpdateMyProfileDto } from './profile.dto';

/** Data diri akun yang login (aplikasi HP kru): hanya miliknya sendiri. */
@UseGuards(JwtAuthGuard)
@Controller('me/profile')
export class MyProfileController {
  constructor(private profile: ProfileService) {}

  @Get()
  get(@CurrentUser('id') userId: string) {
    return this.profile.myProfile(userId);
  }

  @Put()
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateMyProfileDto) {
    return this.profile.updateMyProfile(userId, dto);
  }

  @Post('bank-change')
  requestBankChange(@CurrentUser('id') userId: string, @Body() dto: BankChangeDto) {
    return this.profile.requestBankChange(userId, dto);
  }

  @Delete('bank-change')
  cancelBankChange(@CurrentUser('id') userId: string) {
    return this.profile.cancelBankChange(userId);
  }
}
