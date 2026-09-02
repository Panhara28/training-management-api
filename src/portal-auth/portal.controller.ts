import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { PortalAuthGuard } from '../common/guards/portal-auth.guard';
import { CurrentParticipant } from '../common/decorators/current-participant.decorator';
import type { User } from '@prisma/client';
import { PortalAuthService } from './portal-auth.service';

@ApiTags('Portal')
@ApiCookieAuth('portal_session')
@Controller('api/portal')
@UseGuards(PortalAuthGuard)
export class PortalController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current participant profile' })
  me(@CurrentParticipant() participant: User) {
    return this.portalAuthService.me(participant.id);
  }
}
