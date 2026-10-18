import { Controller, Get, Param, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiForbiddenResponse, ApiUnauthorizedResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import type { Response } from 'express';
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
  @ApiOperation({ summary: 'List participants (admin), paginated and filterable by search/department/training' })
  @ApiOkResponse({ description: '{ total, page, pageSize, items: ParticipantSummary[] }' })
  list(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.participantsService.list({
      search,
      departmentId,
      sessionId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('export')
  @RequirePermission('participants', 'read')
  @ApiOperation({ summary: 'Download the (filtered) participant list as CSV' })
  async export(
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    const csv = await this.participantsService.exportCsv({ search, departmentId, sessionId });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
    res.send(csv);
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
