import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SetAttendancePinDto } from './auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private authService: AuthService) {}

  @Put('attendance-pin')
  async setAttendancePin(@CurrentUser('id') userId: string, @Body() dto: SetAttendancePinDto) {
    return this.authService.setAttendancePin(userId, dto);
  }
}
