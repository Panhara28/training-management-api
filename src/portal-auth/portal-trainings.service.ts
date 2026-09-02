import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { checkAndIssueCertificateIfEligible } from '../lib/certificate-eligibility';
import { CertificateDocumentService } from '../documents/certificate-document.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { SubmitSurveyDto } from './dto/submit-survey.dto';

@Injectable()
export class PortalTrainingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly certificateDocumentService: CertificateDocumentService,
  ) {}

  async listTrainings(userId: number) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            program: true,
            _count: { select: { materials: true, assessments: true, surveyQuestions: true } },
          },
        },
      },
      orderBy: { session: { startDate: 'desc' } },
    });

    return enrollments.map((e) => ({
      enrollmentId: e.id,
      status: e.status,
      score: e.score,
      sessionId: e.session.id,
      title: e.session.title,
      programTitle: e.session.program.title,
      category: e.session.program.category,
      venue: e.session.venue,
      startDate: e.session.startDate,
      endDate: e.session.endDate,
      sessionStatus: e.session.status,
      materialsCount: e.session._count.materials,
      assessmentsCount: e.session._count.assessments,
      hasSurvey: e.session._count.surveyQuestions > 0,
    }));
  }

  async getTraining(userId: number, sessionId: number) {
    const enrollment = await this.getEnrollmentOrThrow(userId, sessionId);

    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        program: true,
        agendaItems: { orderBy: { order: 'asc' } },
        materials: { orderBy: { order: 'asc' } },
        assessments: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: { options: { orderBy: { order: 'asc' } } },
            },
          },
        },
        surveyQuestions: {
          orderBy: { order: 'asc' },
          include: { options: { orderBy: { order: 'asc' } } },
        },
        trainers: { include: { user: { select: { fullName: true } } } },
      },
    });
    if (!trainingSession) throw new NotFoundException({ error: 'Not found' });

    const [assessmentResponses, surveyResponse, certificate] = await Promise.all([
      this.prisma.assessmentResponse.findMany({
        where: { enrollmentId: enrollment.id },
        select: {
          assessmentId: true,
          score: true,
          submittedAt: true,
          answers: { select: { questionId: true, chosenOption: true, isCorrect: true } },
        },
      }),
      this.prisma.surveyResponse.findUnique({
        where: { enrollmentId_sessionId: { enrollmentId: enrollment.id, sessionId } },
        select: { id: true, submittedAt: true },
      }),
      this.prisma.certificate.findFirst({
        where: { userId, sessionId },
        select: { id: true, certificateNo: true, issuedAt: true },
      }),
    ]);
    const submittedAssessmentIds = new Set(assessmentResponses.map((r) => r.assessmentId));

    return {
      id: trainingSession.id,
      title: trainingSession.title,
      programTitle: trainingSession.program.title,
      description: trainingSession.program.description ?? '',
      category: trainingSession.program.category,
      venue: trainingSession.venue,
      hostedBy: trainingSession.hostedBy ?? '',
      startDate: trainingSession.startDate,
      endDate: trainingSession.endDate,
      status: trainingSession.status,
      trainers: trainingSession.trainers.map((t) => t.user.fullName),
      enrollment: { id: enrollment.id, status: enrollment.status, score: enrollment.score },
      certificate: certificate
        ? { id: certificate.id, certificateNo: certificate.certificateNo, issuedAt: certificate.issuedAt }
        : null,
      agendaItems: trainingSession.agendaItems.map((a) => ({
        day: a.day,
        timeFrom: a.timeFrom,
        timeTo: a.timeTo,
        topic: a.topic,
        facilitator: a.facilitator ?? '',
        remarks: a.remarks ?? '',
      })),
      materials: {
        enabled: trainingSession.materialsEnabled,
        count: trainingSession.materials.length,
        items: trainingSession.materialsEnabled
          ? trainingSession.materials.map((m) => ({ id: m.id, type: m.type, title: m.title, value: m.value ?? '' }))
          : [],
      },
      assessments: trainingSession.assessments.map((a) => {
        const response = assessmentResponses.find((r) => r.assessmentId === a.id);
        const answerByQuestion = new Map(response?.answers.map((ans) => [ans.questionId, ans]));
        return {
          id: a.id,
          category: a.category,
          passScore: a.passScore,
          enabled: a.enabled,
          submitted: submittedAssessmentIds.has(a.id),
          score: response?.score ?? null,
          submittedAt: response?.submittedAt ?? null,
          questions: a.questions.map((q) => {
            const given = answerByQuestion.get(q.id);
            return {
              id: q.id,
              type: q.type,
              text: q.text,
              points: q.points,
              options: q.options.map((o) => ({ id: o.id, text: o.text })),
              review: response
                ? { chosenOption: given?.chosenOption ?? null, isCorrect: given?.isCorrect ?? false, correctOption: q.correctOption }
                : null,
            };
          }),
        };
      }),
      survey: {
        enabled: trainingSession.surveyEnabled,
        submitted: !!surveyResponse,
        submittedAt: surveyResponse?.submittedAt ?? null,
        questions: trainingSession.surveyQuestions.map((q) => ({
          id: q.id,
          type: q.type,
          text: q.text,
          required: q.required,
          options: q.options.map((o) => ({ id: o.id, text: o.text })),
        })),
      },
    };
  }

  async submitAssessment(userId: number, sessionId: number, assessmentId: number, body: SubmitAssessmentDto) {
    const enrollment = await this.getEnrollmentOrThrow(userId, sessionId);

    const assessment = await this.prisma.sessionAssessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true },
    });
    if (!assessment || assessment.sessionId !== sessionId) {
      throw new NotFoundException({ error: 'Assessment not found.' });
    }
    if (!assessment.enabled) {
      throw new ForbiddenException({ error: 'This assessment is not open yet.' });
    }

    const existing = await this.prisma.assessmentResponse.findUnique({
      where: { enrollmentId_assessmentId: { enrollmentId: enrollment.id, assessmentId } },
    });
    if (existing) {
      if (existing.score >= assessment.passScore) {
        throw new ConflictException({ error: 'You have already passed this assessment.' });
      }
      await this.prisma.assessmentResponse.delete({ where: { id: existing.id } });
    }

    const answers = body.answers ?? [];
    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    let earnedPoints = 0;
    let totalPoints = 0;
    const answerRows = assessment.questions.map((q) => {
      totalPoints += q.points;
      const given = answerByQuestion.get(q.id);
      const isCorrect =
        q.type !== 'SHORT_ANSWER' &&
        !!q.correctOption &&
        given?.chosenOption !== undefined &&
        given.chosenOption === q.correctOption;
      if (isCorrect) earnedPoints += q.points;
      return {
        questionId: q.id,
        chosenOption: given?.chosenOption ?? null,
        textAnswer: given?.textAnswer ?? null,
        isCorrect,
      };
    });

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    const response = await this.prisma.assessmentResponse.create({
      data: {
        enrollmentId: enrollment.id,
        assessmentId,
        score,
        answers: { create: answerRows },
      },
    });

    const certificate = await checkAndIssueCertificateIfEligible(userId, sessionId, this.prisma);

    return {
      score,
      passed: score >= assessment.passScore,
      submittedAt: response.submittedAt,
      certificateIssued: !!certificate,
      certificateId: certificate?.id ?? null,
    };
  }

  async submitSurvey(userId: number, sessionId: number, body: SubmitSurveyDto) {
    const enrollment = await this.getEnrollmentOrThrow(userId, sessionId);

    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { surveyEnabled: true },
    });
    if (!trainingSession?.surveyEnabled) {
      throw new ForbiddenException({ error: 'The survey is not open yet.' });
    }

    const existing = await this.prisma.surveyResponse.findUnique({
      where: { enrollmentId_sessionId: { enrollmentId: enrollment.id, sessionId } },
    });
    if (existing) throw new ConflictException({ error: 'Survey already submitted.' });

    const questions = await this.prisma.sessionSurveyQuestion.findMany({ where: { sessionId } });
    const questionIds = new Set(questions.map((q) => q.id));

    const answers = (body.answers ?? []).filter((a) => questionIds.has(a.questionId));

    const missingRequired = questions.some((q) => {
      if (!q.required) return false;
      const a = answers.find((x) => x.questionId === q.id);
      return !a || (a.rating === undefined && !a.textAnswer && !a.choices?.length);
    });
    if (missingRequired) {
      throw new ConflictException({ error: 'Please answer all required questions.' });
    }

    await this.prisma.surveyResponse.create({
      data: {
        enrollmentId: enrollment.id,
        sessionId,
        answers: {
          create: answers.map((a) => ({
            questionId: a.questionId,
            rating: a.rating ?? null,
            textAnswer: a.textAnswer ?? null,
            choices: a.choices?.length ? JSON.stringify(a.choices) : null,
          })),
        },
      },
    });

    const certificate = await checkAndIssueCertificateIfEligible(userId, sessionId, this.prisma);

    return { ok: true, certificateIssued: !!certificate, certificateId: certificate?.id ?? null };
  }

  async listCertificates(userId: number) {
    const certificates = await this.prisma.certificate.findMany({
      where: { userId },
      include: { session: { include: { program: true } } },
      orderBy: { issuedAt: 'desc' },
    });

    return certificates.map((c) => ({
      id: c.id,
      certificateNo: c.certificateNo,
      issuedAt: c.issuedAt,
      sessionTitle: c.session.title,
      programTitle: c.session.program.title,
    }));
  }

  async certificateDocument(userId: number, certificateId: number, origin: string): Promise<Buffer> {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        user: { select: { fullName: true } },
        session: { select: { title: true, venue: true, program: { select: { durationDays: true } } } },
      },
    });
    if (!certificate) throw new NotFoundException({ error: 'Certificate not found.' });
    if (certificate.userId !== userId) throw new ForbiddenException({ error: 'Forbidden' });

    const data = this.certificateDocumentService.buildCertificateData(certificate, origin);
    return this.certificateDocumentService.buildCertificatePdf(data);
  }

  private async getEnrollmentOrThrow(userId: number, sessionId: number) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_sessionId: { userId, sessionId } },
    });
    if (!enrollment) throw new ForbiddenException({ error: 'Not enrolled in this training.' });
    return enrollment;
  }
}
