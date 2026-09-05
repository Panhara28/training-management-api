import { BadGatewayException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'crypto';

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

const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

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

  // MOC Object Storage's UAT/prod deployments require the signed API scheme
  // (simple x-access-key/x-secret-key auth is disabled server-side). The
  // canonical string and HMAC mirror the API's own verification logic:
  // `${method}\n${pathname}\n${search}\n${timestamp}\n${payloadHash}`.
  private signedHeaders(
    config: { accessKey: string; secretKey: string },
    method: string,
    url: URL,
    payloadHash: string,
  ) {
    const timestamp = new Date().toISOString();
    const canonical = `${method}\n${url.pathname}\n${url.search}\n${timestamp}\n${payloadHash}`;
    const signature = createHmac('sha256', config.secretKey).update(canonical).digest('hex');

    return {
      'x-api-key': config.accessKey,
      'x-api-signature': signature,
      'x-api-timestamp': timestamp,
      'x-api-body-hash': payloadHash,
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

    // Multipart bodies are re-serialized by multer server-side, so their raw
    // bytes never match a client-computed hash — the API explicitly allows
    // UNSIGNED-PAYLOAD for multipart requests instead.
    const response = await this.safeFetch(requestUrl, {
      method: 'POST',
      headers: {
        ...this.signedHeaders(config, 'POST', requestUrl, UNSIGNED_PAYLOAD),
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

    const emptyBodyHash = createHash('sha256').update(Buffer.alloc(0)).digest('hex');

    const response = await this.safeFetch(requestUrl, {
      method: 'GET',
      headers: this.signedHeaders(config, 'GET', requestUrl, emptyBodyHash),
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
