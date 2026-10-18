import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { issueCertificate } from '../lib/certificate-eligibility';
import { CERTIFICATE_DOCUMENT_INCLUDE, CertificateDocumentService } from '../documents/certificate-document.service';
import { toCsv } from '../lib/csv';
import { CreateCertificateDto } from './dto/create-certificate.dto';

export type ListCertificatesQuery = {
  userId?: string;
  sessionId?: string;
  category?: string;
  search?: string;
  sortKey?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentService: CertificateDocumentService,
  ) {}

  async list(query: ListCertificatesQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));
    const search = query.search?.trim();
    const where: Prisma.CertificateWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      ...(query.category ? { session: { program: { category: query.category } } } : {}),
      ...(search
        ? {
            OR: [
              { certificateNo: { contains: search } },
              { user: { fullName: { contains: search } } },
              { user: { fullNameKh: { contains: search } } },
              { session: { title: { contains: search } } },
              { session: { titleKh: { contains: search } } },
            ],
          }
        : {}),
    };
    const dir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.CertificateOrderByWithRelationInput =
      query.sortKey === 'certificateNo'
        ? { certificateNo: dir }
        : query.sortKey === 'participant'
          ? { user: { fullName: dir } }
          : query.sortKey === 'training'
            ? { session: { title: dir } }
            : { issuedAt: dir };

    const [total, items] = await Promise.all([
      this.prisma.certificate.count({ where }),
      this.prisma.certificate.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, department: { select: { name: true } } },
          },
          session: {
            select: {
              id: true,
              title: true,
              titleKh: true,
              startDate: true,
              endDate: true,
              program: { select: { code: true, title: true, category: true } },
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async create(data: CreateCertificateDto) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_sessionId: { userId: data.userId, sessionId: data.sessionId } },
    });
    if (!enrollment || enrollment.status !== 'ATTENDED') {
      throw new UnprocessableEntityException({ error: 'Participant has not attended this session' });
    }

    const certificate = await issueCertificate(this.prisma, data.userId, data.sessionId);
    if (!certificate) throw new NotFoundException({ error: 'Session not found' });
    return this.prisma.certificate.findUnique({
      where: { id: certificate.id },
      include: {
        user: { select: { fullName: true } },
        session: { select: { title: true } },
      },
    });
  }

  // Issued-vs-pending summary for one training, for the Certificates page's
  // per-training selector.
  async sessionSummary(sessionId: string) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        title: true,
        titleKh: true,
        _count: { select: { enrollments: true, certificates: true } },
      },
    });
    if (!session) throw new NotFoundException({ error: 'Training not found.' });

    const attended = await this.prisma.enrollment.count({ where: { sessionId, status: 'ATTENDED' } });
    const issued = session._count.certificates;
    // Pending = attended but not yet issued a certificate.
    const pending = Math.max(0, attended - issued);

    return {
      sessionId: session.id,
      title: session.title,
      titleKh: session.titleKh,
      totalEnrolled: session._count.enrollments,
      attended,
      issued,
      pending,
    };
  }

  async sessionExport(sessionId: string): Promise<string> {
    const certificates = await this.prisma.certificate.findMany({
      where: { sessionId },
      include: {
        user: {
          select: { fullName: true, fullNameKh: true, email: true, phoneNumber: true, department: { select: { name: true } } },
        },
        session: { select: { title: true, titleKh: true } },
      },
      orderBy: { certificateNo: 'asc' },
    });

    return toCsv(
      certificates.map((c) => ({
        certificateNo: c.certificateNo,
        name: c.user.fullName,
        nameKh: c.user.fullNameKh ?? '',
        email: c.user.email,
        phone: c.user.phoneNumber ?? '',
        department: c.user.department?.name ?? '',
        training: c.session.title,
        trainingKh: c.session.titleKh ?? '',
        issuedAt: c.issuedAt.toISOString().slice(0, 10),
      })),
      [
        { key: 'certificateNo', header: 'Certificate No' },
        { key: 'name', header: 'Name' },
        { key: 'nameKh', header: 'Name (Khmer)' },
        { key: 'email', header: 'Email' },
        { key: 'phone', header: 'Phone' },
        { key: 'department', header: 'Department' },
        { key: 'training', header: 'Training' },
        { key: 'trainingKh', header: 'Training (Khmer)' },
        { key: 'issuedAt', header: 'Issued At' },
      ],
    );
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

  async document(id: string): Promise<Buffer> {
    return this.documentService.buildCertificatePdf(await this.documentData(id));
  }

  async preview(id: string): Promise<Buffer> {
    return this.documentService.buildCertificateJpeg(await this.documentData(id));
  }

  private async documentData(id: string) {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
      include: CERTIFICATE_DOCUMENT_INCLUDE,
    });
    if (!certificate) throw new NotFoundException({ error: 'Certificate not found.' });
    return this.documentService.buildCertificateData(certificate);
  }

  // Every issued certificate of one training batch, one page each.
  async sessionDocument(sessionId: string): Promise<Buffer> {
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
