import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CertificatesService } from './certificates.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';

@ApiTags('Certificates')
@Controller('api/certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'read')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'List certificates, optionally filtered by participant/session' })
  @ApiOkResponse({ description: 'Certificate[]' })
  list(@Query('userId') userId?: string, @Query('sessionId') sessionId?: string) {
    return this.certificatesService.list(userId, sessionId);
  }

  @Post()
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'create')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'Issue a certificate for an attended enrollment' })
  @ApiCreatedResponse({ description: 'Certificate' })
  create(@Body() body: CreateCertificateDto) {
    return this.certificatesService.create(body);
  }

  @Get('verify/:certificateNo')
  @ApiOperation({ summary: 'Publicly verify a certificate by number' })
  @ApiOkResponse({ description: '{ valid, recipientName?, courseTitle?, issuedAt? }' })
  verify(@Param('certificateNo') certificateNo: string) {
    return this.certificatesService.verify(certificateNo);
  }

  @Get(':id/document')
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'read')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'Download a certificate PDF' })
  @ApiNotFoundResponse({ description: 'Certificate not found' })
  async document(@Param('id', ParseIntPipe) id: number, @Req() req: Request, @Res() res: Response) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const pdf = await this.certificatesService.document(id, origin);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificate-${id}.pdf"`);
    res.send(pdf);
  }
}
