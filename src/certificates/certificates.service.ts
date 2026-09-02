import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatCertificateNo } from '../lib/certificate-eligibility';
import { CertificateDocumentService } from '../documents/certificate-document.service';
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

  async document(id: number, origin: string): Promise<Buffer> {
    const certificate = await this.getForDocument(id);
    const data = this.documentService.buildCertificateData(certificate, origin);
    return this.documentService.buildCertificatePdf(data);
  }

  async getForDocument(id: number) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true } },
        session: { select: { title: true, venue: true, program: { select: { durationDays: true } } } },
      },
    });
    if (!certificate) throw new NotFoundException({ error: 'Certificate not found.' });
    return certificate;
  }
}
