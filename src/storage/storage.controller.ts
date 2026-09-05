import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Readable } from 'stream';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { StorageService } from './storage.service';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type UploadedMulterFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

@ApiTags('Storage')
@Controller('api/storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseGuards(StaffAuthGuard, PermissionsGuard)
  @RequirePermission('trainings', 'update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to object storage' })
  @ApiCreatedResponse({ description: '{ slug, url, filename, type }' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async upload(@UploadedFile() file: UploadedMulterFile | undefined) {
    if (!file) {
      return { error: 'A file is required.' };
    }
    const uploaded = await this.storageService.uploadFile({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    return uploaded;
  }

  @Get('download/:slug')
  @ApiOperation({ summary: 'Download/stream a file from object storage' })
  @ApiOkResponse({ description: 'File stream' })
  async download(
    @Param('slug') slug: string,
    @Query('inline') inline: string | undefined,
    @Res() res: Response,
  ) {
    const upstream = await this.storageService.fetchDownload(slug, inline === 'true');

    const contentType = upstream.headers.get('content-type');
    const contentDisposition = upstream.headers.get('content-disposition');
    const contentLength = upstream.headers.get('content-length');
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Helmet's default CSP (object-src 'none') applies globally, but that
    // breaks Chrome's built-in PDF viewer when this response is framed for
    // inline preview. This route only ever serves raw file bytes — no
    // script execution risk — so the page-level CSP doesn't apply here.
    res.removeHeader('Content-Security-Policy');

    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body as import('stream/web').ReadableStream).pipe(res);
  }
}
