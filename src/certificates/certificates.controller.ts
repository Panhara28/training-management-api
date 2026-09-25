import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
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

  @Get('session/:sessionId/document')
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'read')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'Download all certificates of a training batch as one PDF (one page each)' })
  @ApiNotFoundResponse({ description: 'No certificates issued for this training' })
  async sessionDocument(@Param('sessionId', ParseIntPipe) sessionId: number, @Res() res: Response) {
    const pdf = await this.certificatesService.sessionDocument(sessionId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificates-training-${sessionId}.pdf"`);
    res.send(pdf);
  }

  @Get(':id/preview')
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'read')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'Certificate preview image (JPEG)' })
  @ApiNotFoundResponse({ description: 'Certificate not found' })
  async preview(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const image = await this.certificatesService.preview(id);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.send(image);
  }

  @Get(':id/document')
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'read')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'Download a certificate PDF' })
  @ApiNotFoundResponse({ description: 'Certificate not found' })
  async document(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const pdf = await this.certificatesService.document(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificate-${id}.pdf"`);
    res.send(pdf);
  }
}
