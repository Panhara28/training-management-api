import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { PortalAuthController } from './portal-auth.controller';
import { PortalController } from './portal.controller';
import { PortalTrainingsController } from './portal-trainings.controller';
import { PortalCertificatesController } from './portal-certificates.controller';
import { PortalAuthService } from './portal-auth.service';
import { PortalTrainingsService } from './portal-trainings.service';

@Module({
  imports: [CommonModule, AuditModule, DocumentsModule],
  controllers: [PortalAuthController, PortalController, PortalTrainingsController, PortalCertificatesController],
  providers: [PortalAuthService, PortalTrainingsService],
  exports: [PortalAuthService],
})
export class PortalAuthModule {}
