import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@Controller('api/users')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'List staff users' })
  @ApiOkResponse({ description: 'User[]' })
  list(@Query('role') role?: string, @Query('departmentId') departmentId?: string) {
    return this.usersService.list(role, departmentId);
  }

  @Post()
  @RequirePermission('users', 'create')
  @ApiOperation({ summary: 'Create a staff user' })
  @ApiCreatedResponse({ description: 'User' })
  @ApiConflictResponse({ description: 'Username or email already in use' })
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Get(':id')
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'Get a staff user' })
  @ApiOkResponse({ description: 'User' })
  @ApiNotFoundResponse({ description: 'Not found' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.detail(id);
  }

  @Patch(':id')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Update a staff user' })
  @ApiOkResponse({ description: 'User' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserDto) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('users', 'delete')
  @ApiOperation({ summary: 'Delete a staff user' })
  @ApiOkResponse({ description: '{ ok: true }' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
