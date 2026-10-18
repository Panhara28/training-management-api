import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toCsv } from '../lib/csv';

export type ListParticipantsQuery = {
  search?: string;
  departmentId?: string;
  sessionId?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(query: ListParticipantsQuery): Prisma.UserWhereInput {
    const search = query.search?.trim();
    return {
      role: 'PARTICIPANT',
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.sessionId ? { enrollments: { some: { sessionId: query.sessionId } } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { fullNameKh: { contains: search } },
              { email: { contains: search } },
              { username: { contains: search } },
              { phoneNumber: { contains: search } },
            ],
          }
        : {}),
    };
  }

  async list(query: ListParticipantsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, query.pageSize ?? 20));
    const where = this.buildWhere(query);

    const [total, participants] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          department: true,
          _count: { select: { enrollments: true, certificates: true } },
          enrollments: {
            select: { session: { select: { id: true, title: true, titleKh: true } } },
            orderBy: { enrolledAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: participants.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        fullNameKh: p.fullNameKh,
        username: p.username,
        email: p.email,
        gender: p.gender,
        phoneNumber: p.phoneNumber,
        currentRole: p.currentRole,
        generalDepartment: p.generalDepartment,
        departmentOffice: p.departmentOffice,
        departmentName: p.department?.name ?? null,
        enrollmentCount: p._count.enrollments,
        certificateCount: p._count.certificates,
        trainings: p.enrollments.map((e) => ({ id: e.session.id, title: e.session.title, titleKh: e.session.titleKh })),
        createdAt: p.createdAt,
      })),
    };
  }

  // Full filtered list as CSV (no pagination — export respects the same
  // filters as the on-screen list).
  async exportCsv(query: ListParticipantsQuery): Promise<string> {
    const where = this.buildWhere(query);
    const participants = await this.prisma.user.findMany({
      where,
      include: {
        department: true,
        enrollments: { select: { session: { select: { title: true, titleKh: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return toCsv(
      participants.map((p) => ({
        fullName: p.fullName,
        fullNameKh: p.fullNameKh ?? '',
        username: p.username,
        email: p.email,
        gender: p.gender ?? '',
        phoneNumber: p.phoneNumber ?? '',
        currentRole: p.currentRole ?? '',
        generalDepartment: p.generalDepartment ?? '',
        departmentOffice: p.departmentOffice ?? '',
        department: p.department?.name ?? '',
        trainings: p.enrollments.map((e) => e.session.title).join('; '),
        createdAt: p.createdAt.toISOString().slice(0, 10),
      })),
      [
        { key: 'fullName', header: 'Full Name' },
        { key: 'fullNameKh', header: 'Full Name (Khmer)' },
        { key: 'username', header: 'Username' },
        { key: 'email', header: 'Email' },
        { key: 'gender', header: 'Gender' },
        { key: 'phoneNumber', header: 'Phone' },
        { key: 'currentRole', header: 'Position / Role' },
        { key: 'generalDepartment', header: 'Department' },
        { key: 'departmentOffice', header: 'Provincial Department / Office' },
        { key: 'department', header: 'Internal Department' },
        { key: 'trainings', header: 'Enrolled Trainings' },
        { key: 'createdAt', header: 'Joined' },
      ],
    );
  }

  async detail(id: string) {
    const participant = await this.prisma.user.findFirst({
      where: { id, role: 'PARTICIPANT' },
      include: {
        department: true,
        certificates: {
          include: { session: { include: { program: true } } },
          orderBy: { issuedAt: 'desc' },
        },
        enrollments: {
          include: {
            session: { include: { program: true } },
            assessmentResponses: { include: { assessment: true } },
            surveyResponses: { include: { answers: { include: { question: true } } } },
          },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });
    if (!participant) throw new NotFoundException({ error: 'Participant not found.' });

    const attendedCount = participant.enrollments.filter((e) => e.status === 'ATTENDED').length;
    const attendanceRate =
      participant.enrollments.length > 0 ? (attendedCount / participant.enrollments.length) * 100 : 0;

    const allScores = participant.enrollments.flatMap((e) => e.assessmentResponses.map((ar) => ar.score));
    const avgAssessmentScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    return {
      id: participant.id,
      fullName: participant.fullName,
      fullNameKh: participant.fullNameKh,
      username: participant.username,
      email: participant.email,
      gender: participant.gender,
      phoneNumber: participant.phoneNumber,
      currentRole: participant.currentRole,
      generalDepartment: participant.generalDepartment,
      departmentOffice: participant.departmentOffice,
      departmentName: participant.department?.name ?? '—',
      createdAt: participant.createdAt,
      totalEnrollments: participant.enrollments.length,
      attendedCount,
      attendanceRate: Math.round(attendanceRate),
      avgAssessmentScore: Math.round(avgAssessmentScore * 10) / 10,
      certificateCount: participant.certificates.length,
      enrollments: participant.enrollments.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        sessionTitle: e.session.title,
        sessionTitleKh: e.session.titleKh,
        programCode: e.session.program.code,
        programCategory: e.session.program.category,
        startDate: e.session.startDate,
        endDate: e.session.endDate,
        status: e.status,
        enrolledScore: e.score,
        assessmentResponses: e.assessmentResponses.map((ar) => ({
          category: ar.assessment.category,
          score: ar.score,
          passScore: ar.assessment.passScore,
        })),
        surveyResponded: e.surveyResponses.length > 0,
        surveyAnswers: e.surveyResponses.flatMap((sr) =>
          sr.answers.map((ans) => ({
            questionText: ans.question.text,
            questionType: ans.question.type,
            rating: ans.rating,
            textAnswer: ans.textAnswer,
            choices: ans.choices,
          })),
        ),
      })),
      certificates: participant.certificates.map((c) => ({
        id: c.id,
        certificateNo: c.certificateNo,
        issuedAt: c.issuedAt,
        sessionTitle: c.session.title,
        programCode: c.session.program.code,
      })),
    };
  }
}
