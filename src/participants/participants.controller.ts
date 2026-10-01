import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiForbiddenResponse, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ParticipantsService } from './participants.service';

@ApiTags('Participants (admin)')
@Controller('api/participants')
@UseGuards(StaffAuthGuard, PermissionsGuard)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@ApiForbiddenResponse({ description: 'Insufficient permissions' })
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  @RequirePermission('participants', 'read')
  @ApiOperation({ summary: 'List participants (admin)' })
  @ApiOkResponse({ description: 'ParticipantSummary[]' })
  list() {
    return this.participantsService.list();
  }

  @Get(':id')
  @RequirePermission('participants', 'read')
  @ApiOperation({ summary: 'Get participant detail with enrollments and certificates (admin)' })
  @ApiOkResponse({ description: 'ParticipantDetail' })
  @ApiNotFoundResponse({ description: 'Not found' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.participantsService.detail(id);
  }
}
