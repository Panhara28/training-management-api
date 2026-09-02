import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DocumentsModule } from '../documents/documents.module';
import { TrainingSessionsController } from './training-sessions.controller';
import { TrainingsController } from './trainings.controller';
import { TrainersController } from './trainers.controller';
import { TrainingSessionsService } from './training-sessions.service';

@Module({
  imports: [CommonModule, DocumentsModule],
  controllers: [TrainingSessionsController, TrainingsController, TrainersController],
  providers: [TrainingSessionsService],
  exports: [TrainingSessionsService],
})
export class TrainingSessionsModule {}
