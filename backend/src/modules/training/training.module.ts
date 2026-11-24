import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingCrewController } from './training-crew.controller';
import { TrainingModulesService } from './modules.service';
import { WeeklyQuizzesService } from './quizzes.service';
import { TrainingSessionsService } from './sessions.service';
import { TrainingCrewService } from './crew.service';

@Module({
  // Rute kru (training/my) didaftarkan lebih dulu agar tidak tertangkap rute admin training/:...
  controllers: [TrainingCrewController, TrainingController],
  providers: [TrainingModulesService, WeeklyQuizzesService, TrainingSessionsService, TrainingCrewService],
})
export class TrainingModule {}
