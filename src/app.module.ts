import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PortalAuthModule } from './portal-auth/portal-auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { DepartmentsModule } from './departments/departments.module';
import { ProgramsModule } from './programs/programs.module';
import { TrainingSessionsModule } from './training-sessions/training-sessions.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { CertificatesModule } from './certificates/certificates.module';
import { DocumentsModule } from './documents/documents.module';
import { StatsModule } from './stats/stats.module';
import { TrainingPublicModule } from './training-public/training-public.module';
import { ParticipantsModule } from './participants/participants.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    CommonModule,
    AuditModule,
    HealthModule,
    AuthModule,
    PortalAuthModule,
    UsersModule,
    RolesModule,
    DepartmentsModule,
    ProgramsModule,
    TrainingSessionsModule,
    EnrollmentsModule,
    CertificatesModule,
    DocumentsModule,
    StatsModule,
    TrainingPublicModule,
    ParticipantsModule,
    StorageModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
