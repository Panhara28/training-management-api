import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SessionStatus } from '@prisma/client';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { AssignTrainersDto } from './dto/assign-trainers.dto';
import { UpdateAssessmentEnabledDto } from './dto/update-assessment-enabled.dto';
import { CreateTrainingDto } from './dto/training-payload.dto';
import { TrainingInvitationDocumentService } from '../documents/training-invitation-document.service';
import { formatKhmerGregorianDate, toKhmerNumeral } from '../lib/khmer-date';
import { hashPassword } from '../lib/crypto';

// Organizational constants not tracked in the schema — same for every training invitation.
const PRESIDING_OFFICIAL = 'ឯកឧត្តម គវ៉េង សុធី រដ្ឋលេខាធិការក្រសួងពាណិជ្ជកម្ម';
const LUNAR_DATE_TEXT = 'ថ្ងៃអង្គារ ១រោច ខែបឋមាសាឍ ឆ្នាំមមីអដ្ឋស័ក ព.ស.២៥៧០';
const TELEGRAM_LINK = 'https://t.me/+8ihSJNhEiTg5NTY1';
const CONTACT_PHONE = '០១២ ៣៩៣ ២៥៣';
const SIGNER_NAME = 'ផល យីនា';
const SIGNER_TITLE = 'ប្រធានវិទ្យាស្ថាន';
const DEFAULT_SESSION_TIME_TEXT = '៨:០០ នាទីព្រឹក';

const MATERIAL_TYPE = { file: 'FILE', link: 'LINK', video: 'VIDEO' } as const;
const ASSESS_CATEGORY = { pre: 'PRE', post: 'POST', exam: 'EXAM' } as const;
const QUESTION_TYPE = {
  multiple_choice: 'MULTIPLE_CHOICE',
  true_false: 'TRUE_FALSE',
  short_answer: 'SHORT_ANSWER',
} as const;
const SURVEY_TYPE = {
  rating: 'RATING',
  single_choice: 'SINGLE_CHOICE',
  multiple_choice: 'MULTIPLE_CHOICE',
  open_ended: 'OPEN_ENDED',
} as const;

@Injectable()
export class TrainingSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationDocumentService: TrainingInvitationDocumentService,
  ) {}

  // ─── /api/sessions ────────────────────────────────────────────────────────

  listSessions(status?: string) {
    return this.prisma.trainingSession.findMany({
      where: status ? { status: status as SessionStatus } : {},
      include: {
        program: { select: { code: true, title: true, category: true, durationDays: true } },
        trainers: { include: { user: { select: { id: true, fullName: true } } } },
        _count: { select: { enrollments: true, certificates: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  createSession(data: CreateSessionDto) {
    return this.prisma.trainingSession.create({
      data: {
        programId: Number(data.programId),
        title: data.title,
        venue: data.venue,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        maxCapacity: Number(data.maxCapacity),
      },
      include: { program: { select: { code: true, title: true } } },
    });
  }

  async getSession(id: number) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: {
        program: true,
        trainers: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                department: { select: { name: true } },
              },
            },
          },
          orderBy: { enrolledAt: 'asc' },
        },
        certificates: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });
    if (!session) throw new NotFoundException({ error: 'Not found' });
    return session;
  }

  async updateSession(id: number, data: UpdateSessionDto) {
    await this.ensureSessionExists(id);
    return this.prisma.trainingSession.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.publishStatus ? { publishStatus: data.publishStatus } : {}),
        ...(data.surveyEnabled !== undefined ? { surveyEnabled: data.surveyEnabled } : {}),
        ...(data.materialsEnabled !== undefined ? { materialsEnabled: data.materialsEnabled } : {}),
      },
    });
  }

  async assignTrainers(id: number, data: AssignTrainersDto) {
    await this.ensureSessionExists(id);
    const userIds = data.userIds ?? [];

    await this.prisma.$transaction([
      this.prisma.trainerOnSession.deleteMany({ where: { sessionId: id } }),
      this.prisma.trainerOnSession.createMany({
        data: userIds.map((userId) => ({ userId, sessionId: id })),
      }),
    ]);

    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: { trainers: { include: { user: { select: { id: true, fullName: true } } } } },
    });

    return { users: session?.trainers.map((t) => t.user) ?? [] };
  }

  async updateAssessmentEnabled(
    sessionId: number,
    assessmentId: number,
    data: UpdateAssessmentEnabledDto,
  ) {
    const assessment = await this.prisma.sessionAssessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment || assessment.sessionId !== sessionId) {
      throw new NotFoundException({ error: 'Not found' });
    }
    return this.prisma.sessionAssessment.update({
      where: { id: assessmentId },
      data: { enabled: data.enabled },
    });
  }

  // ─── /api/trainers ────────────────────────────────────────────────────────

  listTrainers() {
    return this.prisma.user.findMany({
      where: { role: 'TRAINER' },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async trainerDetail(id: number) {
    const trainer = await this.prisma.user.findFirst({
      where: { id, role: 'TRAINER' },
      include: {
        department: true,
        staffRole: true,
        sessions: {
          include: {
            session: {
              include: {
                program: true,
                _count: { select: { enrollments: true } },
              },
            },
          },
          orderBy: { session: { startDate: 'desc' } },
        },
      },
    });
    if (!trainer) throw new NotFoundException({ error: 'Trainer not found.' });

    const sessions = trainer.sessions.map((t) => ({
      id: t.session.id,
      title: t.session.title,
      programCode: t.session.program.code,
      programCategory: t.session.program.category,
      venue: t.session.venue,
      startDate: t.session.startDate,
      endDate: t.session.endDate,
      status: t.session.status,
      enrolledCount: t.session._count.enrollments,
    }));

    return {
      id: trainer.id,
      fullName: trainer.fullName,
      email: trainer.email,
      isActive: trainer.isActive,
      createdAt: trainer.createdAt,
      departmentName: trainer.department?.name ?? null,
      staffRoleName: trainer.staffRole?.name ?? null,
      sessionCount: sessions.length,
      upcomingCount: sessions.filter((s) => s.status === 'UPCOMING').length,
      ongoingCount: sessions.filter((s) => s.status === 'ONGOING').length,
      completedCount: sessions.filter((s) => s.status === 'COMPLETED').length,
      totalParticipants: sessions.reduce((sum, s) => sum + s.enrolledCount, 0),
      sessions,
    };
  }

  // ─── /api/trainings (composite) ──────────────────────────────────────────

  private validateTrainingBody(body: CreateTrainingDto) {
    const { programCode, category, trainingTitle, startDate, endDate, venue } = body;
    if (!programCode || !category || !trainingTitle || !startDate || !endDate || !venue) {
      throw new BadRequestException({
        error: 'Program code, category, title, start date, end date and venue are required.',
      });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new BadRequestException({ error: 'Invalid date range.' });
    }
    return { start, end };
  }

  async createTraining(body: CreateTrainingDto) {
    const { start, end } = this.validateTrainingBody(body);
    const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

    const program = await this.prisma.trainingProgram.upsert({
      where: { code: body.programCode },
      update: {
        title: body.trainingTitle,
        description: body.description ?? null,
        category: body.category,
        durationDays,
      },
      create: {
        code: body.programCode,
        title: body.trainingTitle,
        description: body.description ?? null,
        category: body.category,
        durationDays,
      },
    });

    const session = await this.prisma.$transaction(async (tx) => {
      const sess = await tx.trainingSession.create({
        data: {
          programId: program.id,
          title: body.trainingTitle,
          venue: body.venue,
          hostedBy: body.hostedBy ?? null,
          startDate: start,
          endDate: end,
          status: 'UPCOMING',
        },
      });

      if (body.agendaItems?.length) {
        await tx.sessionAgendaItem.createMany({
          data: body.agendaItems.map((item, i) => ({
            sessionId: sess.id,
            day: item.day,
            timeFrom: item.timeFrom,
            timeTo: item.timeTo,
            topic: item.topic,
            facilitator: item.facilitator ?? null,
            remarks: item.remarks ?? null,
            order: i,
          })),
        });
      }

      if (body.materials?.length) {
        await tx.sessionMaterial.createMany({
          data: body.materials.map((m, i) => ({
            sessionId: sess.id,
            type: MATERIAL_TYPE[m.type],
            title: m.title,
            value: m.value ?? null,
            order: i,
          })),
        });
      }

      for (const assess of body.assessments ?? []) {
        const dbAssess = await tx.sessionAssessment.create({
          data: {
            sessionId: sess.id,
            category: ASSESS_CATEGORY[assess.category],
            passScore: assess.passScore,
          },
        });

        for (const [qi, q] of (assess.questions ?? []).entries()) {
          const dbQ = await tx.assessmentQuestion.create({
            data: {
              assessmentId: dbAssess.id,
              type: QUESTION_TYPE[q.type],
              text: q.text,
              correctOption: q.correctOption ?? null,
              points: q.points,
              order: qi,
            },
          });

          if (q.options?.length) {
            await tx.questionOption.createMany({
              data: q.options.map((opt, oi) => ({ questionId: dbQ.id, text: opt.text, order: oi })),
            });
          }
        }
      }

      for (const [si, sq] of (body.surveyQuestions ?? []).entries()) {
        const dbSq = await tx.sessionSurveyQuestion.create({
          data: {
            sessionId: sess.id,
            type: SURVEY_TYPE[sq.type],
            text: sq.text,
            required: sq.required,
            order: si,
          },
        });

        if (sq.options?.length) {
          await tx.surveyQuestionOption.createMany({
            data: sq.options.map((opt, oi) => ({ questionId: dbSq.id, text: opt.text, order: oi })),
          });
        }
      }

      return sess;
    });

    return { sessionId: session.id };
  }

  async getTraining(id: number) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
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
      },
    });
    if (!session) throw new NotFoundException({ error: 'Not found' });

    return {
      programCode: session.program.code,
      category: session.program.category,
      trainingTitle: session.title,
      description: session.program.description ?? '',
      startDate: session.startDate.toISOString().slice(0, 10),
      endDate: session.endDate.toISOString().slice(0, 10),
      venue: session.venue,
      hostedBy: session.hostedBy ?? '',
      agendaItems: session.agendaItems.map((a) => ({
        day: a.day,
        timeFrom: a.timeFrom,
        timeTo: a.timeTo,
        topic: a.topic,
        facilitator: a.facilitator ?? '',
        remarks: a.remarks ?? '',
      })),
      materials: session.materials.map((m) => ({
        type: m.type.toLowerCase(),
        title: m.title,
        value: m.value ?? '',
      })),
      assessments: session.assessments.map((a) => ({
        category: a.category.toLowerCase(),
        passScore: a.passScore,
        questions: a.questions.map((q) => ({
          type: q.type.toLowerCase(),
          text: q.text,
          correctOption: q.correctOption ?? '',
          points: q.points,
          options: q.options.map((o) => ({ text: o.text })),
        })),
      })),
      surveyQuestions: session.surveyQuestions.map((sq) => ({
        type: sq.type.toLowerCase(),
        text: sq.text,
        required: sq.required,
        options: sq.options.map((o) => ({ text: o.text })),
      })),
    };
  }

  async updateTraining(id: number, body: CreateTrainingDto) {
    const existing = await this.prisma.trainingSession.findUnique({
      where: { id },
      select: { id: true, programId: true },
    });
    if (!existing) throw new NotFoundException({ error: 'Not found' });

    const { start, end } = this.validateTrainingBody(body);
    const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.trainingProgram.update({
        where: { id: existing.programId },
        data: {
          title: body.trainingTitle,
          description: body.description ?? null,
          category: body.category,
          durationDays,
        },
      });

      await tx.trainingSession.update({
        where: { id },
        data: {
          title: body.trainingTitle,
          venue: body.venue,
          hostedBy: body.hostedBy ?? null,
          startDate: start,
          endDate: end,
        },
      });

      await tx.sessionAgendaItem.deleteMany({ where: { sessionId: id } });
      if (body.agendaItems?.length) {
        await tx.sessionAgendaItem.createMany({
          data: body.agendaItems.map((item, i) => ({
            sessionId: id,
            day: item.day,
            timeFrom: item.timeFrom,
            timeTo: item.timeTo,
            topic: item.topic,
            facilitator: item.facilitator ?? null,
            remarks: item.remarks ?? null,
            order: i,
          })),
        });
      }

      await tx.sessionMaterial.deleteMany({ where: { sessionId: id } });
      if (body.materials?.length) {
        await tx.sessionMaterial.createMany({
          data: body.materials.map((m, i) => ({
            sessionId: id,
            type: MATERIAL_TYPE[m.type],
            title: m.title,
            value: m.value ?? null,
            order: i,
          })),
        });
      }

      await tx.sessionAssessment.deleteMany({ where: { sessionId: id } });
      for (const assess of body.assessments ?? []) {
        const dbAssess = await tx.sessionAssessment.create({
          data: { sessionId: id, category: ASSESS_CATEGORY[assess.category], passScore: assess.passScore },
        });
        for (const [qi, q] of (assess.questions ?? []).entries()) {
          const dbQ = await tx.assessmentQuestion.create({
            data: {
              assessmentId: dbAssess.id,
              type: QUESTION_TYPE[q.type],
              text: q.text,
              correctOption: q.correctOption ?? null,
              points: q.points,
              order: qi,
            },
          });
          if (q.options?.length) {
            await tx.questionOption.createMany({
              data: q.options.map((opt, oi) => ({ questionId: dbQ.id, text: opt.text, order: oi })),
            });
          }
        }
      }

      await tx.sessionSurveyQuestion.deleteMany({ where: { sessionId: id } });
      for (const [si, sq] of (body.surveyQuestions ?? []).entries()) {
        const dbSq = await tx.sessionSurveyQuestion.create({
          data: { sessionId: id, type: SURVEY_TYPE[sq.type], text: sq.text, required: sq.required, order: si },
        });
        if (sq.options?.length) {
          await tx.surveyQuestionOption.createMany({
            data: sq.options.map((opt, oi) => ({ questionId: dbSq.id, text: opt.text, order: oi })),
          });
        }
      }
    });

    return { sessionId: id };
  }

  // ─── /api/trainings/:id/document (invitation PDF) ────────────────────────

  async document(id: number): Promise<Buffer> {
    const session = await this.prisma.trainingSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException({ error: 'Training not found.' });

    const replyDeadline = new Date(session.startDate);
    replyDeadline.setDate(replyDeadline.getDate() - 1);

    const issuedDate = new Date();

    return this.invitationDocumentService.buildTrainingInvitationPdf({
      subjectTitle: session.title,
      sessionDateText: formatKhmerGregorianDate(session.startDate),
      sessionTimeText: DEFAULT_SESSION_TIME_TEXT,
      venueText: session.venue,
      presidingOfficial: PRESIDING_OFFICIAL,
      issuedDateText: `រាជធានីភ្នំពេញ ${formatKhmerGregorianDate(issuedDate)}`,
      lunarDateText: LUNAR_DATE_TEXT,
      telegramLink: TELEGRAM_LINK,
      contactPhone: CONTACT_PHONE,
      replyDeadlineText: formatKhmerGregorianDate(replyDeadline),
      signerName: SIGNER_NAME,
      signerTitle: SIGNER_TITLE,
      referenceNo: `០${toKhmerNumeral(session.id)}/២៦ វ.បពស`,
    });
  }

  // ─── /api/trainings/:id/analytics ────────────────────────────────────────

  async analytics(sessionId: number) {
    const [enrollments, assessments, surveyQuestions, surveyResponses] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { sessionId },
        include: { user: { select: { fullName: true, department: { select: { name: true } } } } },
        orderBy: { enrolledAt: 'asc' },
      }),
      this.prisma.sessionAssessment.findMany({
        where: { sessionId },
        include: { questions: { orderBy: { order: 'asc' } }, responses: { include: { answers: true } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.sessionSurveyQuestion.findMany({
        where: { sessionId },
        orderBy: { order: 'asc' },
        include: { options: { orderBy: { order: 'asc' } }, answers: true },
      }),
      this.prisma.surveyResponse.findMany({ where: { sessionId } }),
    ]);

    const total = enrollments.length;
    const attended = enrollments.filter((e) => e.status === 'ATTENDED').length;
    const absent = enrollments.filter((e) => e.status === 'ABSENT').length;
    const dropped = enrollments.filter((e) => e.status === 'DROPPED').length;
    const still = enrollments.filter((e) => e.status === 'ENROLLED').length;

    const attendance = {
      total,
      attended,
      absent,
      dropped,
      enrolled: still,
      rate: total > 0 ? Math.round((attended / total) * 100) : 0,
      participants: enrollments.map((e) => ({
        id: e.id,
        name: e.user.fullName,
        department: e.user.department?.name ?? '—',
        status: e.status as string,
        score: e.score,
      })),
    };

    const assessmentStats = assessments.map((a) => {
      const responses = a.responses;
      const n = responses.length;

      if (n === 0) {
        return {
          category: a.category as string,
          passScore: a.passScore,
          totalResponses: 0,
          avgScore: 0,
          passRate: 0,
          highest: 0,
          lowest: 0,
          distribution: this.scoreBuckets([]),
          questionStats: a.questions.map((q) => ({
            text: q.text,
            type: q.type as string,
            correctRate: 0,
            totalAnswered: 0,
          })),
        };
      }

      const scores = responses.map((r) => r.score);
      const avg = scores.reduce((s, v) => s + v, 0) / n;
      const passRate = (scores.filter((s) => s >= a.passScore).length / n) * 100;

      const questionStats = a.questions.map((q) => {
        const answers = responses.flatMap((r) => r.answers.filter((ans) => ans.questionId === q.id));
        const totalAnswered = answers.length;
        const correct = answers.filter((ans) => ans.isCorrect).length;
        return {
          text: q.text,
          type: q.type as string,
          correctRate: totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0,
          totalAnswered,
        };
      });

      return {
        category: a.category as string,
        passScore: a.passScore,
        totalResponses: n,
        avgScore: Math.round(avg * 10) / 10,
        passRate: Math.round(passRate),
        highest: Math.max(...scores),
        lowest: Math.min(...scores),
        distribution: this.scoreBuckets(scores),
        questionStats,
      };
    });

    const surveyStats = surveyQuestions.map((q) => {
      const answers = q.answers;
      const n = answers.length;

      if (q.type === 'RATING') {
        const ratings = answers.map((a) => a.rating ?? 0).filter((r) => r > 0);
        const avgRating =
          ratings.length > 0
            ? Math.round((ratings.reduce((s, v) => s + v, 0) / ratings.length) * 10) / 10
            : 0;
        const ratingDist = [1, 2, 3, 4, 5].map((val) => {
          const count = ratings.filter((r) => r === val).length;
          return { value: val, count, pct: ratings.length > 0 ? Math.round((count / ratings.length) * 100) : 0 };
        });
        return { id: q.id, text: q.text, type: q.type as string, totalAnswers: n, avgRating, ratingDist };
      }

      if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
        const options = q.options.map((opt, i) => {
          const count = answers.filter((a) => {
            try {
              return (JSON.parse(a.choices ?? '[]') as number[]).includes(i);
            } catch {
              return false;
            }
          }).length;
          return { text: opt.text, count, pct: n > 0 ? Math.round((count / n) * 100) : 0 };
        });
        return { id: q.id, text: q.text, type: q.type as string, totalAnswers: n, options };
      }

      if (q.type === 'OPEN_ENDED') {
        const textAnswers = answers.map((a) => a.textAnswer ?? '').filter(Boolean);
        return { id: q.id, text: q.text, type: q.type as string, totalAnswers: n, textAnswers };
      }

      return { id: q.id, text: q.text, type: q.type as string, totalAnswers: n };
    });

    const hasData = total > 0 || surveyResponses.length > 0;

    return {
      sessionId,
      hasData,
      attendance,
      assessments: assessmentStats,
      survey: { totalResponses: surveyResponses.length, questions: surveyStats },
    };
  }

  private scoreBuckets(scores: number[]) {
    const ranges = [
      { label: '0–49', min: 0, max: 49 },
      { label: '50–59', min: 50, max: 59 },
      { label: '60–69', min: 60, max: 69 },
      { label: '70–79', min: 70, max: 79 },
      { label: '80–89', min: 80, max: 89 },
      { label: '90–100', min: 90, max: 100 },
    ];
    const n = scores.length;
    return ranges.map(({ label, min, max }) => {
      const count = scores.filter((s) => s >= min && s <= max).length;
      return { label, count, pct: n > 0 ? Math.round((count / n) * 100) : 0 };
    });
  }

  // ─── /api/trainings/:id/seed-analytics (dev/demo helper) ────────────────

  async seedAnalytics(sessionId: number) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        assessments: { include: { questions: { include: { options: true } } } },
        surveyQuestions: { include: { options: true } },
        enrollments: true,
      },
    });
    if (!session) throw new NotFoundException({ error: 'Session not found' });

    await this.prisma.$transaction([
      this.prisma.assessmentResponse.deleteMany({ where: { assessment: { sessionId } } }),
      this.prisma.surveyResponse.deleteMany({ where: { sessionId } }),
    ]);

    let enrollments = session.enrollments;

    if (enrollments.length === 0) {
      const passwordHash = hashPassword('test1234');
      const deptRecords = await Promise.all(
        SEED_DEPARTMENTS.map((name) =>
          this.prisma.department.upsert({ where: { name }, create: { name }, update: {} }),
        ),
      );

      const names = SEED_FAKE_NAMES.slice(0, 16);
      const created = await Promise.all(
        names.map(async (fullName, i) => {
          const username = `testuser_s${sessionId}_${i + 1}`;
          const email = `${username}@ttri.test`;
          const user = await this.prisma.user.upsert({
            where: { username },
            create: {
              username,
              email,
              passwordHash,
              fullName,
              role: 'PARTICIPANT',
              departmentId: this.pick(deptRecords).id,
            },
            update: {},
          });
          return this.prisma.enrollment.upsert({
            where: { userId_sessionId: { userId: user.id, sessionId } },
            create: { userId: user.id, sessionId, status: 'ENROLLED' },
            update: {},
          });
        }),
      );
      enrollments = created;
    }

    const n = enrollments.length;
    const attendedCount = Math.round(n * 0.8);
    const absentCount = Math.round(n * 0.12);

    const shuffled = [...enrollments].sort(() => Math.random() - 0.5);
    const attendedIds = new Set(shuffled.slice(0, attendedCount).map((e) => e.id));
    const absentIds = new Set(shuffled.slice(attendedCount, attendedCount + absentCount).map((e) => e.id));

    await Promise.all(
      enrollments.map((e) => {
        const status = attendedIds.has(e.id) ? 'ATTENDED' : absentIds.has(e.id) ? 'ABSENT' : 'DROPPED';
        return this.prisma.enrollment.update({ where: { id: e.id }, data: { status } });
      }),
    );

    const attendedEnrollments = enrollments.filter((e) => attendedIds.has(e.id));
    const assessMeans: Record<string, number> = { PRE: 57, POST: 74, EXAM: 79 };
    const assessStddev = 14;

    for (const assessment of session.assessments) {
      const mean = assessMeans[assessment.category] ?? 70;

      for (const enrollment of attendedEnrollments) {
        const rawScore = this.gaussianScore(mean, assessStddev);
        const scaledPct = rawScore / 100;

        const answers = assessment.questions.map((q) => {
          if (q.type === 'SHORT_ANSWER') {
            return {
              questionId: q.id,
              chosenOption: null,
              textAnswer: 'Sample answer',
              isCorrect: Math.random() < scaledPct,
            };
          }
          const optCount = q.options.length;
          if (optCount === 0) {
            return { questionId: q.id, chosenOption: null, textAnswer: null, isCorrect: false };
          }
          const correct = q.correctOption !== null ? parseInt(q.correctOption) : 0;
          const isCorrect = Math.random() < scaledPct;
          const chosen = isCorrect
            ? correct
            : (() => {
                let idx = Math.floor(Math.random() * optCount);
                if (idx === correct && optCount > 1) idx = (idx + 1) % optCount;
                return idx;
              })();
          return { questionId: q.id, chosenOption: String(chosen), textAnswer: null, isCorrect };
        });

        const totalPoints = assessment.questions.reduce((s, q) => s + q.points, 0);
        let earnedPoints = 0;
        for (let qi = 0; qi < assessment.questions.length; qi++) {
          if (answers[qi].isCorrect) earnedPoints += assessment.questions[qi].points;
        }
        const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : rawScore;

        await this.prisma.assessmentResponse.create({
          data: {
            enrollmentId: enrollment.id,
            assessmentId: assessment.id,
            score: finalScore,
            answers: { createMany: { data: answers } },
          },
        });

        if (assessment.category === 'EXAM' || assessment.category === 'POST') {
          await this.prisma.enrollment.update({ where: { id: enrollment.id }, data: { score: finalScore } });
        }
      }
    }

    if (session.surveyQuestions.length > 0) {
      for (const enrollment of attendedEnrollments) {
        const answers = session.surveyQuestions.map((q) => {
          if (q.type === 'RATING') {
            return { questionId: q.id, rating: this.weightedRating(), textAnswer: null, choices: null };
          }
          if (q.type === 'SINGLE_CHOICE') {
            const opts = q.options;
            const weights = opts.map((_, i) => Math.max(1, opts.length - i));
            const total = weights.reduce((s, w) => s + w, 0);
            let r = Math.random() * total;
            let chosen = 0;
            for (let i = 0; i < weights.length; i++) {
              r -= weights[i];
              if (r <= 0) {
                chosen = i;
                break;
              }
            }
            return { questionId: q.id, rating: null, textAnswer: null, choices: JSON.stringify([chosen]) };
          }
          if (q.type === 'MULTIPLE_CHOICE') {
            const selected = q.options.map((_, i) => i).filter(() => Math.random() > 0.4);
            const final = selected.length === 0 ? [0] : selected;
            return { questionId: q.id, rating: null, textAnswer: null, choices: JSON.stringify(final) };
          }
          return {
            questionId: q.id,
            rating: null,
            textAnswer: Math.random() > 0.2 ? this.pick(SEED_OPEN_ENDED_FEEDBACK) : null,
            choices: null,
          };
        });

        await this.prisma.surveyResponse.create({
          data: { enrollmentId: enrollment.id, sessionId, answers: { createMany: { data: answers } } },
        });
      }
    }

    return { seeded: true, participants: enrollments.length, attended: attendedEnrollments.length };
  }

  private gaussianScore(mean: number, stddev: number): number {
    const u = Math.random() || 1e-10;
    const v = Math.random() || 1e-10;
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.max(0, Math.min(100, Math.round(mean + z * stddev)));
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private weightedRating(): number {
    const r = Math.random();
    if (r < 0.05) return 1;
    if (r < 0.1) return 2;
    if (r < 0.25) return 3;
    if (r < 0.55) return 4;
    return 5;
  }

  private async ensureSessionExists(id: number) {
    const exists = await this.prisma.trainingSession.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException({ error: 'Not found' });
  }
}

const SEED_FAKE_NAMES = [
  'Sok Vantha', 'Chan Dara', 'Kim Sophea', 'Ly Ratha', 'Heng Sokha',
  'Meas Pisey', 'Pich Bopha', 'Nget Vannak', 'Try Sothea', 'Khim Davi',
  'Ros Mony', 'Sam Rotha', 'Tep Narin', 'Ung Sovanna', 'Va Kunthea',
  'Wai Chenda', 'Yem Sokun', 'Zen Vireak', 'Ann Chanthy', 'Bou Sreyleak',
];

const SEED_DEPARTMENTS = ['Operations', 'Finance', 'Human Resources', 'IT', 'Administration'];

const SEED_OPEN_ENDED_FEEDBACK = [
  'The training was very well organized and informative.',
  'I learned a lot of practical skills that I can apply immediately.',
  'The facilitators were knowledgeable and engaging.',
  'Would love to have more hands-on exercises.',
  'Excellent content and delivery. Highly recommend.',
  'The materials provided were comprehensive and easy to follow.',
  'Great learning experience overall.',
  'The sessions were interactive and kept me engaged throughout.',
  'Very relevant to my daily work responsibilities.',
  'I appreciated the real-world examples used during the training.',
  'The training exceeded my expectations.',
  'Good balance between theory and practice.',
];
