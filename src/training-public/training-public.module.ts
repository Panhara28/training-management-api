import { Module } from '@nestjs/common';
import { TrainingPublicController } from './training-public.controller';
import { TrainingPublicService } from './training-public.service';

@Module({
  imports: [],
  controllers: [TrainingPublicController],
  providers: [TrainingPublicService],
})
export class TrainingPublicModule {}
