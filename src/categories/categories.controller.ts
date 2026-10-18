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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

// Categories are a sub-resource of training programs, so they're gated by
// the existing `trainings` permission rather than a new permission module.
@ApiTags('Training Categories')
@Controller('api/categories')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermission('trainings', 'read')
  @ApiOperation({ summary: 'List training categories' })
  @ApiOkResponse({ description: 'TrainingCategory[]' })
  list() {
    return this.categoriesService.list();
  }

  @Post()
  @RequirePermission('trainings', 'create')
  @ApiOperation({ summary: 'Create a training category (inline "add new" from the program form)' })
  @ApiCreatedResponse({ description: 'TrainingCategory' })
  create(@Body() body: CreateCategoryDto) {
    return this.categoriesService.create(body);
  }
}
