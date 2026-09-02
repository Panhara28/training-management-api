import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { DocumentsModule } from '../documents/documents.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [CommonModule, DocumentsModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
