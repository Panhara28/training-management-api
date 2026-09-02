import { Controller, Get, Param, ParseIntPipe, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiCookieAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PortalAuthGuard } from '../common/guards/portal-auth.guard';
import { CurrentParticipant } from '../common/decorators/current-participant.decorator';
import type { User } from '@prisma/client';
import { PortalTrainingsService } from './portal-trainings.service';

@ApiTags('Portal Certificates')
@ApiCookieAuth('portal_session')
@Controller('api/portal/certificates')
@UseGuards(PortalAuthGuard)
export class PortalCertificatesController {
  constructor(private readonly portalTrainingsService: PortalTrainingsService) {}

  @Get()
  @ApiOperation({ summary: "List the current participant's certificates" })
  @ApiOkResponse({ description: 'PortalCertificate[]' })
  list(@CurrentParticipant() participant: User) {
    return this.portalTrainingsService.listCertificates(participant.id);
  }

  @Get(':id/document')
  @ApiOperation({ summary: 'Download a certificate PDF (own certificate only)' })
  async document(
    @CurrentParticipant() participant: User,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const pdf = await this.portalTrainingsService.certificateDocument(participant.id, id, origin);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificate-${id}.pdf"`);
    res.send(pdf);
  }
}
