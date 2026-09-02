import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TrainingSessionsService } from './training-sessions.service';

// Lightweight trainer roster for the agenda facilitator picker and the
// Assign Trainer dialog — gated on "trainings" access (not "users"), since
// Trainer accounts can read/update trainings but don't have "users" module
// permission and would otherwise get a silent 403 from /api/users.
@ApiTags('Trainers')
@Controller('api/trainers')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class TrainersController {
  constructor(private readonly sessionsService: TrainingSessionsService) {}

  @Get()
  @RequirePermission('trainings', 'read')
  @ApiOperation({ summary: 'List trainer accounts' })
  @ApiOkResponse({ description: '{ id, fullName }[]' })
  list() {
    return this.sessionsService.listTrainers();
  }
}
