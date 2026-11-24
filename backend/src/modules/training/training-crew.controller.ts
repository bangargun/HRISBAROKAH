import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TrainingCrewService } from './crew.service';
import { SubmitAnswersDto } from './training.dto';

/** Pelatihan untuk akun yang login di aplikasi HP: hanya data miliknya sendiri. */
@UseGuards(JwtAuthGuard)
@Controller('training/my')
export class TrainingCrewController {
  constructor(private crew: TrainingCrewService) {}

  @Get('modules')
  modules(@CurrentUser('id') userId: string) {
    return this.crew.modules(userId);
  }

  @Get('modules/:id')
  module(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.crew.module(userId, id);
  }

  @Post('modules/:id/attempts')
  submitModule(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: SubmitAnswersDto) {
    return this.crew.submitModule(userId, id, dto);
  }

  @Get('quizzes')
  quizzes(@CurrentUser('id') userId: string) {
    return this.crew.quizzes(userId);
  }

  @Get('quizzes/:id')
  quiz(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.crew.quiz(userId, id);
  }

  @Post('quizzes/:id/attempts')
  submitQuiz(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: SubmitAnswersDto) {
    return this.crew.submitQuiz(userId, id, dto);
  }

  @Get('sessions')
  sessions(@CurrentUser('id') userId: string) {
    return this.crew.sessions(userId);
  }
}
