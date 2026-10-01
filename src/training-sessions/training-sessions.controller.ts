import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TrainingSessionsService } from './training-sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { AssignTrainersDto } from './dto/assign-trainers.dto';
import { UpdateAssessmentEnabledDto } from './dto/update-assessment-enabled.dto';

@ApiTags('Training Sessions')
@Controller('api/sessions')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class TrainingSessionsController {
  constructor(private readonly sessionsService: TrainingSessionsService) {}

  @Get()
  @RequirePermission('trainings', 'read')
  @ApiOperation({ summary: 'List training sessions' })
  @ApiOkResponse({ description: 'TrainingSession[]' })
  list(@Query('status') status?: string) {
    return this.sessionsService.listSessions(status);
  }

  @Post()
  @RequirePermission('trainings', 'create')
  @ApiOperation({ summary: 'Create a training session' })
  @ApiCreatedResponse({ description: 'TrainingSession' })
  create(@Body() body: CreateSessionDto) {
    return this.sessionsService.createSession(body);
  }

  @Get(':id')
  @RequirePermission('trainings', 'read')
  @ApiOperation({ summary: 'Get a training session with trainers/enrollments/certificates' })
  @ApiOkResponse({ description: 'TrainingSession' })
  @ApiNotFoundResponse({ description: 'Not found' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.getSession(id);
  }

  @Patch(':id')
  @RequirePermission('trainings', 'update')
  @ApiOperation({ summary: 'Update session status/publish/toggles' })
  @ApiOkResponse({ description: 'TrainingSession' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateSessionDto) {
    return this.sessionsService.updateSession(id, body);
  }

  @Patch(':id/trainers')
  @RequirePermission('trainings', 'update')
  @ApiOperation({ summary: 'Assign trainers to a session' })
  @ApiOkResponse({ description: '{ users }' })
  assignTrainers(@Param('id', ParseUUIDPipe) id: string, @Body() body: AssignTrainersDto) {
    return this.sessionsService.assignTrainers(id, body);
  }

  @Patch(':id/assessments/:assessmentId')
  @RequirePermission('trainings', 'update')
  @ApiOperation({ summary: 'Enable/disable a session assessment' })
  @ApiOkResponse({ description: 'SessionAssessment' })
  @ApiNotFoundResponse({ description: 'Not found' })
  updateAssessment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() body: UpdateAssessmentEnabledDto,
  ) {
    return this.sessionsService.updateAssessmentEnabled(id, assessmentId, body);
  }
}
