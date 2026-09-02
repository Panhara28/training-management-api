import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [CommonModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
