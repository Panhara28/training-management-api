import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
import { ProgramsService } from './programs.service';
import { CreateProgramDto } from './dto/create-program.dto';

@ApiTags('Training Programs')
@Controller('api/programs')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class ProgramsController {
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  @RequirePermission('trainings', 'read')
  @ApiOperation({ summary: 'List training programs' })
  @ApiOkResponse({ description: 'TrainingProgram[]' })
  list() {
    return this.programsService.list();
  }

  @Post()
  @RequirePermission('trainings', 'create')
  @ApiOperation({ summary: 'Create a training program' })
  @ApiCreatedResponse({ description: 'TrainingProgram' })
  create(@Body() body: CreateProgramDto) {
    return this.programsService.create(body);
  }
}
