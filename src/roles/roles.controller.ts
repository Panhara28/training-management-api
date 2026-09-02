import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AssignUsersDto } from './dto/assign-users.dto';

@ApiTags('Roles')
@Controller('api/roles')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'List staff roles' })
  @ApiOkResponse({ description: 'StaffRole[]' })
  list() {
    return this.rolesService.list();
  }

  @Post()
  @RequirePermission('users', 'create')
  @ApiOperation({ summary: 'Create a staff role' })
  @ApiCreatedResponse({ description: 'StaffRole' })
  @ApiConflictResponse({ description: 'Role name/slug already exists' })
  create(@Body() body: CreateRoleDto) {
    return this.rolesService.create(body);
  }

  @Get(':id')
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'Get a staff role with permissions' })
  @ApiOkResponse({ description: 'StaffRole' })
  @ApiNotFoundResponse({ description: 'Not found' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.detail(id);
  }

  @Patch(':id')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Update a staff role name/description' })
  @ApiOkResponse({ description: 'StaffRole' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateRoleDto) {
    return this.rolesService.update(id, body);
  }

  @Patch(':id/permissions')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Update the permission matrix for a role' })
  @ApiOkResponse({ description: 'StaffRole' })
  updatePermissions(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateRolePermissionsDto) {
    return this.rolesService.updatePermissions(id, body);
  }

  @Patch(':id/users')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Assign users to a role' })
  @ApiOkResponse({ description: '{ ok: true }' })
  assignUsers(@Param('id', ParseIntPipe) id: number, @Body() body: AssignUsersDto) {
    return this.rolesService.assignUsers(id, body);
  }

  @Delete(':id')
  @RequirePermission('users', 'delete')
  @ApiOperation({ summary: 'Delete a staff role' })
  @ApiOkResponse({ description: '{ ok: true }' })
  @ApiConflictResponse({ description: 'Role still assigned to users' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }
}
