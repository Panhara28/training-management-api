import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCookieAuth, ApiForbiddenResponse } from '@nestjs/swagger';
import { PortalAuthGuard } from '../common/guards/portal-auth.guard';
import { CurrentParticipant } from '../common/decorators/current-participant.decorator';
import type { User } from '@prisma/client';
import { PortalTrainingsService } from './portal-trainings.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { SubmitSurveyDto } from './dto/submit-survey.dto';

@ApiTags('Portal Trainings')
@ApiCookieAuth('portal_session')
@Controller('api/portal/trainings')
@UseGuards(PortalAuthGuard)
export class PortalTrainingsController {
  constructor(private readonly portalTrainingsService: PortalTrainingsService) {}

  @Get()
  @ApiOperation({ summary: "List the current participant's enrollments" })
  @ApiOkResponse({ description: 'PortalTrainingSummary[]' })
  list(@CurrentParticipant() participant: User) {
    return this.portalTrainingsService.listTrainings(participant.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get training detail for an enrolled participant' })
  @ApiOkResponse({ description: 'PortalTrainingDetail' })
  @ApiForbiddenResponse({ description: 'Not enrolled in this training' })
  get(@CurrentParticipant() participant: User, @Param('id', ParseIntPipe) id: number) {
    return this.portalTrainingsService.getTraining(participant.id, id);
  }

  @Post(':id/assessments/:assessmentId')
  @ApiOperation({ summary: 'Submit answers for a session assessment' })
  @ApiOkResponse({ description: '{ score, passed, submittedAt, certificateIssued, certificateId }' })
  submitAssessment(
    @CurrentParticipant() participant: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('assessmentId', ParseIntPipe) assessmentId: number,
    @Body() body: SubmitAssessmentDto,
  ) {
    return this.portalTrainingsService.submitAssessment(participant.id, id, assessmentId, body);
  }

  @Post(':id/survey')
  @ApiOperation({ summary: 'Submit the post-training survey' })
  @ApiOkResponse({ description: '{ ok, certificateIssued, certificateId }' })
  submitSurvey(
    @CurrentParticipant() participant: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SubmitSurveyDto,
  ) {
    return this.portalTrainingsService.submitSurvey(participant.id, id, body);
  }
}
