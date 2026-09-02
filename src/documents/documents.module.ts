import { Module } from '@nestjs/common';
import { CertificateDocumentService } from './certificate-document.service';
import { TrainingInvitationDocumentService } from './training-invitation-document.service';

@Module({
  providers: [CertificateDocumentService, TrainingInvitationDocumentService],
  exports: [CertificateDocumentService, TrainingInvitationDocumentService],
})
export class DocumentsModule {}
