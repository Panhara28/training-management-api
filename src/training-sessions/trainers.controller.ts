import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
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

  // Trainer profile + assigned sessions for the admin-facing Trainers roster
  // detail page — gated on "users" access (not "trainings"), matching the
  // /api/users?role=TRAINER list this page reads from.
  @Get(':id')
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'Get a trainer profile and their assigned sessions' })
  @ApiOkResponse({ description: 'Trainer detail with sessions[]' })
  @ApiNotFoundResponse({ description: 'Not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.trainerDetail(id);
  }
}
