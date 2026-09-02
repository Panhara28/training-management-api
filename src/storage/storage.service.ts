import { BadGatewayException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';

type UploadableFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

type MocUpload = {
  slug: string;
  url: string;
  filename: string;
  storedFilename: string;
  type: string;
};

@Injectable()
export class StorageService {
  private getConfig() {
    const baseUrl = process.env.MOC_STORAGE_BASE_URL?.trim();
    const accessKey = process.env.MOC_STORAGE_ACCESS_KEY?.trim();
    const secretKey = process.env.MOC_STORAGE_SECRET_KEY?.trim();
    const bucketSlug = process.env.MOC_STORAGE_BUCKET_SLUG?.trim();

    if (!baseUrl || !accessKey || !secretKey || !bucketSlug) {
      throw new ServiceUnavailableException('Object storage integration is not configured.');
    }

    return { baseUrl, accessKey, secretKey, bucketSlug };
  }

  private authHeaders(config: { accessKey: string; secretKey: string; bucketSlug: string }) {
    return {
      'x-access-key': config.accessKey,
      'x-secret-key': config.secretKey,
      'x-bucket-slug': config.bucketSlug,
    };
  }

  async uploadFile(file: UploadableFile): Promise<MocUpload> {
    const config = this.getConfig();
    const requestUrl = new URL('/api/external/upload', config.baseUrl);

    const boundary = `----tms${randomUUID().replace(/-/g, '')}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="files"; filename="${file.originalname.replace(/"/g, '\\"')}"\r\n` +
          `Content-Type: ${file.mimetype || 'application/octet-stream'}\r\n\r\n`,
        'utf8',
      ),
      file.buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);

    const response = await this.safeFetch(requestUrl, {
      method: 'POST',
      headers: {
        ...this.authHeaders(config),
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });

    const payload = await this.readJson(response);
    if (!response.ok) {
      throw new BadGatewayException(payload?.message ?? 'Object storage upload failed.');
    }

    const uploaded = Array.isArray(payload?.uploads) ? payload.uploads[0] : null;
    if (!uploaded?.slug || !uploaded?.url) {
      throw new BadGatewayException('Object storage returned an invalid upload response.');
    }

    return {
      slug: uploaded.slug,
      url: uploaded.url,
      filename: uploaded.filename ?? file.originalname,
      storedFilename: uploaded.storedFilename ?? file.originalname,
      type: uploaded.type ?? 'OTHER',
    };
  }

  async fetchDownload(slug: string, inline: boolean): Promise<Response> {
    const config = this.getConfig();
    const requestUrl = new URL('/api/external/download', config.baseUrl);
    requestUrl.searchParams.set('mediaSlug', slug);
    requestUrl.searchParams.set('inline', String(inline));

    const response = await this.safeFetch(requestUrl, {
      method: 'GET',
      headers: this.authHeaders(config),
    });

    if (response.status === 404) {
      throw new NotFoundException('File not found.');
    }
    if (!response.ok) {
      const payload = await this.readJson(response);
      throw new BadGatewayException(payload?.message ?? 'Object storage download failed.');
    }

    return response;
  }

  private async safeFetch(url: URL, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch {
      throw new BadGatewayException('Could not reach the object storage service.');
    }
  }

  private async readJson(response: Response): Promise<Record<string, unknown> | null> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
