import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatCertificateNo } from '../lib/certificate-eligibility';
import { CERTIFICATE_DOCUMENT_INCLUDE, CertificateDocumentService } from '../documents/certificate-document.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: CertificateDocumentService,
  ) {}

  list(userId?: string, sessionId?: string) {
    return this.prisma.certificate.findMany({
      where: {
        ...(userId ? { userId: Number(userId) } : {}),
        ...(sessionId ? { sessionId: Number(sessionId) } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        session: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            program: { select: { code: true, title: true } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async create(data: CreateCertificateDto) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_sessionId: { userId: Number(data.userId), sessionId: Number(data.sessionId) } },
    });
    if (!enrollment || enrollment.status !== 'ATTENDED') {
      throw new UnprocessableEntityException({ error: 'Participant has not attended this session' });
    }

    const certNo = formatCertificateNo(Number(data.sessionId), Number(data.userId));
    return this.prisma.certificate.upsert({
      where: { certificateNo: certNo },
      update: {},
      create: { userId: Number(data.userId), sessionId: Number(data.sessionId), certificateNo: certNo },
      include: {
        user: { select: { fullName: true } },
        session: { select: { title: true } },
      },
    });
  }

  async verify(certificateNo: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { certificateNo },
      include: {
        user: { select: { fullName: true } },
        session: { select: { title: true } },
      },
    });
    if (!certificate) return { valid: false };

    return {
      valid: true,
      recipientName: certificate.user.fullName,
      courseTitle: certificate.session.title,
      issuedAt: certificate.issuedAt,
    };
  }

  async document(id: number): Promise<Buffer> {
    return this.documentService.buildCertificatePdf(await this.documentData(id));
  }

  async preview(id: number): Promise<Buffer> {
    return this.documentService.buildCertificateJpeg(await this.documentData(id));
  }

  private async documentData(id: number) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
      include: CERTIFICATE_DOCUMENT_INCLUDE,
    });
    if (!certificate) throw new NotFoundException({ error: 'Certificate not found.' });
    return this.documentService.buildCertificateData(certificate);
  }

  // Every issued certificate of one training batch, one page each.
  async sessionDocument(sessionId: number): Promise<Buffer> {
    const certificates = await this.prisma.certificate.findMany({
      where: { sessionId },
      include: CERTIFICATE_DOCUMENT_INCLUDE,
      orderBy: { certificateNo: 'asc' },
    });
    if (certificates.length === 0) {
      throw new NotFoundException({ error: 'No certificates have been issued for this training yet.' });
    }
    return this.documentService.buildCertificatePdf(certificates.map((c) => this.documentService.buildCertificateData(c)));
  }
}
