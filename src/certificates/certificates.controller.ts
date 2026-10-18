import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'List certificates (paginated), filterable by participant/training/category/search' })
  @ApiOkResponse({ description: '{ total, page, pageSize, items: Certificate[] }' })
  list(
    @Query('userId') userId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('sortKey') sortKey?: string,
    @Query('sortDir') sortDir?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.certificatesService.list({
      userId,
      sessionId,
      category,
      search,
      sortKey,
      sortDir,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
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

  @Get('session/:sessionId/summary')
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'read')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'Certificate issuance summary (issued/pending) for one training' })
  @ApiNotFoundResponse({ description: 'Training not found' })
  sessionSummary(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.certificatesService.sessionSummary(sessionId);
  }

  @Get('session/:sessionId/export')
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'read')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'Download participants issued a certificate for one training (CSV)' })
  async sessionExport(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Res() res: Response) {
    const csv = await this.certificatesService.sessionExport(sessionId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="certificates-${sessionId}.csv"`);
    res.send(csv);
  }

  @Get('session/:sessionId/document')
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('certificates', 'read')
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiOperation({ summary: 'Download all certificates of a training batch as one PDF (one page each)' })
  @ApiNotFoundResponse({ description: 'No certificates issued for this training' })
  async sessionDocument(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Res() res: Response) {
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
  async preview(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
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
  async document(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const pdf = await this.certificatesService.document(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificate-${id}.pdf"`);
    res.send(pdf);
  }
}
