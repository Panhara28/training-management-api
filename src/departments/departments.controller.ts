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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@ApiTags('Departments')
@Controller('api/departments')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermission('participants', 'read')
  @ApiOperation({ summary: 'List departments' })
  @ApiOkResponse({ description: 'Department[]' })
  list() {
    return this.departmentsService.list();
  }

  @Post()
  @RequirePermission('participants', 'create')
  @ApiOperation({ summary: 'Create a department' })
  @ApiCreatedResponse({ description: 'Department' })
  create(@Body() body: CreateDepartmentDto) {
    return this.departmentsService.create(body);
  }
}
