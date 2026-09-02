import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [CommonModule],
  controllers: [StorageController],
  providers: [StorageService],
})
export class StorageModule {}
