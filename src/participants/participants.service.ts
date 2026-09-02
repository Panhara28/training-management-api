import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const participants = await this.prisma.user.findMany({
      where: { role: 'PARTICIPANT' },
      include: {
        department: true,
        enrollments: { select: { id: true } },
        certificates: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return participants.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      username: p.username,
      email: p.email,
      departmentName: p.department?.name ?? '—',
      enrollmentCount: p.enrollments.length,
      certificateCount: p.certificates.length,
      createdAt: p.createdAt,
    }));
  }

  async detail(id: number) {
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
      username: participant.username,
      email: participant.email,
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
