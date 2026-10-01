import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TrainingSessionsService } from './training-sessions.service';
import { CreateTrainingDto } from './dto/training-payload.dto';

@ApiTags('Trainings')
@Controller('api/trainings')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class TrainingsController {
  constructor(private readonly sessionsService: TrainingSessionsService) {}

  @Post()
  @RequirePermission('trainings', 'create')
  @ApiOperation({ summary: 'Create a training (program + session + agenda + materials + assessments + survey)' })
  @ApiCreatedResponse({ description: '{ sessionId }' })
  create(@Body() body: CreateTrainingDto) {
    return this.sessionsService.createTraining(body);
  }

  @Get(':id')
  @RequirePermission('trainings', 'read')
  @ApiOperation({ summary: 'Get a training in edit-form shape' })
  @ApiOkResponse({ description: 'TrainingFormShape' })
  @ApiNotFoundResponse({ description: 'Not found' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.getTraining(id);
  }

  @Put(':id')
  @RequirePermission('trainings', 'update')
  @ApiOperation({ summary: 'Replace a training (program + session + agenda + materials + assessments + survey)' })
  @ApiOkResponse({ description: '{ sessionId }' })
  @ApiNotFoundResponse({ description: 'Not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: CreateTrainingDto) {
    return this.sessionsService.updateTraining(id, body);
  }

  @Get(':id/analytics')
  @RequirePermission('trainings', 'read')
  @ApiOperation({ summary: 'Get attendance/assessment/survey analytics for a training' })
  @ApiOkResponse({ description: 'TrainingAnalytics' })
  analytics(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.analytics(id);
  }

  @Get(':id/document')
  @RequirePermission('trainings', 'read')
  @ApiOperation({ summary: 'Download the Khmer invitation PDF for a training' })
  @ApiNotFoundResponse({ description: 'Training not found' })
  async document(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const pdf = await this.sessionsService.document(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invitation-${id}.pdf"`);
    res.send(pdf);
  }

  @Post(':id/seed-analytics')
  @RequirePermission('trainings', 'create')
  @ApiOperation({ summary: 'Seed demo analytics data for a training (dev/demo helper)' })
  @ApiOkResponse({ description: '{ seeded, participants, attended }' })
  seedAnalytics(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.seedAnalytics(id);
  }
}
