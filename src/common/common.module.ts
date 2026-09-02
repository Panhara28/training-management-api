import { Module } from '@nestjs/common';
import { StaffAuthGuard } from './guards/staff-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PortalAuthGuard } from './guards/portal-auth.guard';

@Module({
  providers: [StaffAuthGuard, PermissionsGuard, PortalAuthGuard],
  exports: [StaffAuthGuard, PermissionsGuard, PortalAuthGuard],
})
export class CommonModule {}
