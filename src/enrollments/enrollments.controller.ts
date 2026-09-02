import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@ApiTags('Enrollments')
@Controller('api/enrollments')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  @RequirePermission('participants', 'read')
  @ApiOperation({ summary: 'List enrollments, optionally filtered by session/participant' })
  @ApiOkResponse({ description: 'Enrollment[]' })
  list(@Query('sessionId') sessionId?: string, @Query('userId') userId?: string) {
    return this.enrollmentsService.list(sessionId, userId);
  }

  @Post()
  @RequirePermission('participants', 'create')
  @ApiOperation({ summary: 'Enroll a participant into a session' })
  @ApiCreatedResponse({ description: 'Enrollment' })
  create(@Body() body: CreateEnrollmentDto) {
    return this.enrollmentsService.create(body);
  }

  @Patch()
  @RequirePermission('participants', 'update')
  @ApiOperation({ summary: 'Update enrollment status/score' })
  @ApiOkResponse({ description: 'Enrollment' })
  update(@Body() body: UpdateEnrollmentDto) {
    return this.enrollmentsService.update(body);
  }
}
