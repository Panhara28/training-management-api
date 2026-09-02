import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import type { AuthenticatedStaff } from '../common/interfaces/authenticated-staff.interface';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@Controller('api/stats')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @RequirePermission('reports', 'read')
  @ApiOperation({ summary: 'Dashboard aggregate stats' })
  @ApiOkResponse({ description: 'DashboardStats' })
  dashboard() {
    return this.statsService.dashboard();
  }

  @Get('dashboard-overview')
  @ApiOperation({ summary: 'Trainer-scoped overview for the admin dashboard page' })
  @ApiOkResponse({ description: 'DashboardOverview' })
  dashboardOverview(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.statsService.dashboardOverview(staff);
  }

  @Get('reports-overview')
  @RequirePermission('reports', 'read')
  @ApiOperation({ summary: 'Org-wide aggregate report' })
  @ApiOkResponse({ description: 'ReportsOverview' })
  reportsOverview() {
    return this.statsService.reportsOverview();
  }
}
