import { Global, Module } from '@nestjs/common';
import { FaceRecognitionService } from './face-recognition.service';
import { FaceEnrollmentService } from './face-enrollment.service';
import { FaceController } from './face.controller';

@Global()
@Module({
  controllers: [FaceController],
  providers: [FaceRecognitionService, FaceEnrollmentService],
  exports: [FaceRecognitionService, FaceEnrollmentService],
})
export class FaceModule {}
