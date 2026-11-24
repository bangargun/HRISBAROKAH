import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TrainingModulesService } from './modules.service';
import { WeeklyQuizzesService } from './quizzes.service';
import { TrainingSessionsService } from './sessions.service';
import { AttendanceDto, PublishDto, SaveModuleDto, SaveSessionDto, SaveWeeklyQuizDto, SessionStatusDto } from './training.dto';

const MANAGE = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN];
const VIEW = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.AREA_MANAGER, UserRole.STORE_MANAGER];

/** Pelatihan dari sisi admin: modul, kuis mingguan, sertifikasi, jadwal sesi. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('training')
export class TrainingController {
  constructor(
    private modules: TrainingModulesService,
    private quizzes: WeeklyQuizzesService,
    private sessions: TrainingSessionsService,
  ) {}

  @Roles(...VIEW)
  @Get('modules')
  listModules() {
    return this.modules.list();
  }

  @Roles(...MANAGE)
  @Get('modules/:id')
  module(@Param('id') id: string) {
    return this.modules.detail(id);
  }

  @Roles(...MANAGE)
  @Post('modules')
  createModule(@CurrentUser() user, @Body() dto: SaveModuleDto) {
    return this.modules.create(user, dto);
  }

  @Roles(...MANAGE)
  @Put('modules/:id')
  updateModule(@Param('id') id: string, @Body() dto: SaveModuleDto) {
    return this.modules.update(id, dto);
  }

  @Roles(...MANAGE)
  @Patch('modules/:id/publish')
  publishModule(@Param('id') id: string, @Body() dto: PublishDto) {
    return this.modules.publish(id, dto);
  }

  @Roles(...MANAGE)
  @Delete('modules/:id')
  removeModule(@Param('id') id: string) {
    return this.modules.remove(id);
  }

  @Roles(...VIEW)
  @Get('modules/:id/results')
  moduleResults(@CurrentUser() user, @Param('id') id: string, @Query('outletId') outletId?: string) {
    return this.modules.results(user, id, outletId);
  }

  @Roles(...VIEW)
  @Get('certificates')
  certificates(@CurrentUser() user, @Query('outletId') outletId?: string, @Query('moduleId') moduleId?: string) {
    return this.modules.certificates(user, outletId, moduleId);
  }

  @Roles(...VIEW)
  @Get('quizzes')
  listQuizzes() {
    return this.quizzes.list();
  }

  @Roles(...MANAGE)
  @Get('quizzes/:id')
  quiz(@Param('id') id: string) {
    return this.quizzes.detail(id);
  }

  @Roles(...MANAGE)
  @Post('quizzes')
  createQuiz(@CurrentUser() user, @Body() dto: SaveWeeklyQuizDto) {
    return this.quizzes.create(user, dto);
  }

  @Roles(...MANAGE)
  @Put('quizzes/:id')
  updateQuiz(@Param('id') id: string, @Body() dto: SaveWeeklyQuizDto) {
    return this.quizzes.update(id, dto);
  }

  @Roles(...MANAGE)
  @Patch('quizzes/:id/publish')
  publishQuiz(@Param('id') id: string, @Body() dto: PublishDto) {
    return this.quizzes.publish(id, dto);
  }

  @Roles(...MANAGE)
  @Delete('quizzes/:id')
  removeQuiz(@Param('id') id: string) {
    return this.quizzes.remove(id);
  }

  @Roles(...VIEW)
  @Get('quizzes/:id/results')
  quizResults(@CurrentUser() user, @Param('id') id: string, @Query('outletId') outletId?: string) {
    return this.quizzes.results(user, id, outletId);
  }

  @Roles(...VIEW)
  @Get('sessions')
  listSessions(@CurrentUser() user, @Query('outletId') outletId?: string) {
    return this.sessions.list(user, outletId);
  }

  @Roles(...MANAGE)
  @Post('sessions')
  createSession(@CurrentUser() user, @Body() dto: SaveSessionDto) {
    return this.sessions.create(user, dto);
  }

  @Roles(...MANAGE)
  @Put('sessions/:id')
  updateSession(@Param('id') id: string, @Body() dto: SaveSessionDto) {
    return this.sessions.update(id, dto);
  }

  @Roles(...MANAGE)
  @Patch('sessions/:id/status')
  sessionStatus(@Param('id') id: string, @Body() dto: SessionStatusDto) {
    return this.sessions.setStatus(id, dto);
  }

  @Roles(...VIEW)
  @Patch('sessions/:id/attendance')
  sessionAttendance(@CurrentUser() user, @Param('id') id: string, @Body() dto: AttendanceDto) {
    return this.sessions.attendance(user, id, dto);
  }

  @Roles(...MANAGE)
  @Delete('sessions/:id')
  removeSession(@Param('id') id: string) {
    return this.sessions.remove(id);
  }
}
