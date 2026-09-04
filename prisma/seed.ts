import 'dotenv/config';
import {
  PrismaClient, Role, SessionStatus, EnrollmentStatus,
  AssessmentCategory, QuestionType, SurveyQuestionType, MaterialType,
} from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';
import { formatCertificateNo } from '../src/lib/certificate-eligibility';

const prisma = new PrismaClient();

// Demo password for every seeded account: "password123"
const DEMO_PASSWORD_HASH = hashPassword('password123');

async function main() {
  console.log('🌱 Seeding database...');

  // ── Permission Modules & Staff Roles ────────────────────────────────────────
  const moduleDefs = [
    { name: 'trainings', label: 'Trainings' },
    { name: 'participants', label: 'Participants' },
    { name: 'certificates', label: 'Certificates' },
    { name: 'schedule', label: 'Schedule' },
    { name: 'reports', label: 'Reports' },
    { name: 'users', label: 'Users' },
  ];
  const modules = await Promise.all(
    moduleDefs.map((m) => prisma.permissionModule.upsert({ where: { name: m.name }, update: {}, create: m })),
  );

  const adminStaffRole = await prisma.staffRole.upsert({
    where: { slug: 'administrator' },
    update: {},
    create: { name: 'Administrator', slug: 'administrator' },
  });
  const trainerStaffRole = await prisma.staffRole.upsert({
    where: { slug: 'trainer' },
    update: {},
    create: { name: 'Trainer', slug: 'trainer' },
  });

  for (const m of modules) {
    await prisma.staffRolePermission.upsert({
      where: { staffRoleId_moduleId: { staffRoleId: adminStaffRole.id, moduleId: m.id } },
      update: { create: true, read: true, update: true, delete: true },
      create: { staffRoleId: adminStaffRole.id, moduleId: m.id, create: true, read: true, update: true, delete: true },
    });
  }

  const trainerMatrix: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }> = {
    trainings: { create: false, read: true, update: false, delete: false },
    schedule: { create: false, read: true, update: false, delete: false },
    participants: { create: false, read: true, update: false, delete: false },
    certificates: { create: false, read: true, update: false, delete: false },
    reports: { create: false, read: true, update: false, delete: false },
    users: { create: false, read: false, update: false, delete: false },
  };
  for (const m of modules) {
    const perms = trainerMatrix[m.name];
    await prisma.staffRolePermission.upsert({
      where: { staffRoleId_moduleId: { staffRoleId: trainerStaffRole.id, moduleId: m.id } },
      update: perms,
      create: { staffRoleId: trainerStaffRole.id, moduleId: m.id, ...perms },
    });
  }
  console.log(`  ✓ ${modules.length} permission modules, 2 staff roles`);

  // ── Departments ─────────────────────────────────────────────────────────────
  const departments = await Promise.all([
    prisma.department.upsert({ where: { name: 'Human Resources' }, update: {}, create: { name: 'Human Resources' } }),
    prisma.department.upsert({ where: { name: 'Information Technology' }, update: {}, create: { name: 'Information Technology' } }),
    prisma.department.upsert({ where: { name: 'Finance' }, update: {}, create: { name: 'Finance' } }),
    prisma.department.upsert({ where: { name: 'Operations' }, update: {}, create: { name: 'Operations' } }),
    prisma.department.upsert({ where: { name: 'Legal' }, update: {}, create: { name: 'Legal' } }),
  ]);
  console.log(`  ✓ ${departments.length} departments`);

  // ── Users ───────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: DEMO_PASSWORD_HASH, staffRoleId: adminStaffRole.id, isActive: true },
    create: {
      username: 'admin',
      email: 'admin@ttri.gov.kh',
      passwordHash: DEMO_PASSWORD_HASH,
      fullName: 'System Administrator',
      role: Role.ADMIN,
      departmentId: departments[0].id,
      staffRoleId: adminStaffRole.id,
      isActive: true,
    },
  });

  const trainers = await Promise.all([
    prisma.user.upsert({
      where: { username: 'trainer.sok' },
      update: { passwordHash: DEMO_PASSWORD_HASH, staffRoleId: trainerStaffRole.id, isActive: true },
      create: {
        username: 'trainer.sok',
        email: 'sok.vantha@ttri.gov.kh',
        passwordHash: DEMO_PASSWORD_HASH,
        fullName: 'Sok Vantha',
        role: Role.TRAINER,
        departmentId: departments[1].id,
        staffRoleId: trainerStaffRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'trainer.dara' },
      update: { passwordHash: DEMO_PASSWORD_HASH, staffRoleId: trainerStaffRole.id, isActive: true },
      create: {
        username: 'trainer.dara',
        email: 'dara.chea@ttri.gov.kh',
        passwordHash: DEMO_PASSWORD_HASH,
        fullName: 'Dara Chea',
        role: Role.TRAINER,
        departmentId: departments[0].id,
        staffRoleId: trainerStaffRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'trainer.linda' },
      update: { passwordHash: DEMO_PASSWORD_HASH, staffRoleId: trainerStaffRole.id, isActive: true },
      create: {
        username: 'trainer.linda',
        email: 'linda.kong@ttri.gov.kh',
        passwordHash: DEMO_PASSWORD_HASH,
        fullName: 'Linda Kong',
        role: Role.TRAINER,
        departmentId: departments[2].id,
        staffRoleId: trainerStaffRole.id,
        isActive: true,
      },
    }),
  ]);

  const participants = await Promise.all(
    [
      { username: 'chan.mony', fullName: 'Chan Mony', email: 'chan.mony@gov.kh', deptIdx: 3 },
      { username: 'rina.pich', fullName: 'Rina Pich', email: 'rina.pich@gov.kh', deptIdx: 0 },
      { username: 'vuth.leak', fullName: 'Vuth Leak', email: 'vuth.leak@gov.kh', deptIdx: 1 },
      { username: 'srey.mom', fullName: 'Srey Mom', email: 'srey.mom@gov.kh', deptIdx: 2 },
      { username: 'kosal.dim', fullName: 'Kosal Dim', email: 'kosal.dim@gov.kh', deptIdx: 4 },
      { username: 'pisey.tan', fullName: 'Pisey Tan', email: 'pisey.tan@gov.kh', deptIdx: 0 },
      { username: 'bora.nuth', fullName: 'Bora Nuth', email: 'bora.nuth@gov.kh', deptIdx: 1 },
      { username: 'sreyroth.ly', fullName: 'Sreyroth Ly', email: 'sreyroth.ly@gov.kh', deptIdx: 3 },
      { username: 'makara.hen', fullName: 'Makara Hen', email: 'makara.hen@gov.kh', deptIdx: 2 },
      { username: 'sophea.ros', fullName: 'Sophea Ros', email: 'sophea.ros@gov.kh', deptIdx: 4 },
      { username: 'virak.heng', fullName: 'Virak Heng', email: 'virak.heng@gov.kh', deptIdx: 0 },
      { username: 'channary.im', fullName: 'Channary Im', email: 'channary.im@gov.kh', deptIdx: 1 },
    ].map((p) =>
      prisma.user.upsert({
        where: { username: p.username },
        update: { passwordHash: DEMO_PASSWORD_HASH },
        create: {
          username: p.username,
          email: p.email,
          passwordHash: DEMO_PASSWORD_HASH,
          fullName: p.fullName,
          role: Role.PARTICIPANT,
          departmentId: departments[p.deptIdx].id,
        },
      }),
    ),
  );
  console.log(`  ✓ ${1 + trainers.length + participants.length} users`);

  // ── Training Programs ────────────────────────────────────────────────────────
  const programs = await Promise.all([
    prisma.trainingProgram.upsert({
      where: { code: 'LDP-01' },
      update: {},
      create: {
        code: 'LDP-01',
        title: 'Leadership Development Program',
        description: 'Develop essential leadership and management skills for mid-level officials.',
        category: 'Leadership',
        durationDays: 5,
      },
    }),
    prisma.trainingProgram.upsert({
      where: { code: 'DSW-02' },
      update: {},
      create: {
        code: 'DSW-02',
        title: 'Digital Skills Workshop',
        description: 'Practical training on digital tools, data literacy, and cybersecurity basics.',
        category: 'Technology',
        durationDays: 3,
      },
    }),
    prisma.trainingProgram.upsert({
      where: { code: 'PMF-03' },
      update: {},
      create: {
        code: 'PMF-03',
        title: 'Project Management Fundamentals',
        description: 'Foundations of project planning, execution, and monitoring using modern frameworks.',
        category: 'Management',
        durationDays: 4,
      },
    }),
    prisma.trainingProgram.upsert({
      where: { code: 'PSC-04' },
      update: {},
      create: {
        code: 'PSC-04',
        title: 'Public Speaking & Communication',
        description: 'Enhance oral presentation, writing, and stakeholder communication skills.',
        category: 'Communication',
        durationDays: 2,
      },
    }),
    prisma.trainingProgram.upsert({
      where: { code: 'FMB-05' },
      update: {},
      create: {
        code: 'FMB-05',
        title: 'Financial Management Basics',
        description: 'Budgeting, expenditure tracking, and public finance regulations.',
        category: 'Finance',
        durationDays: 3,
      },
    }),
  ]);
  console.log(`  ✓ ${programs.length} training programs`);

  // ── Sessions ─────────────────────────────────────────────────────────────────
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

  async function seedSession(data: {
    programId: number; title: string; venue: string; startDate: Date; endDate: Date;
    maxCapacity: number; status: SessionStatus;
  }) {
    const existing = await prisma.trainingSession.findFirst({ where: { title: data.title, programId: data.programId } });
    if (existing) return existing;
    return prisma.trainingSession.create({ data });
  }

  const sessions = [
    await seedSession({
      programId: programs[0].id,
      title: 'Leadership Development – Batch 1',
      venue: 'TTRI Conference Hall A',
      startDate: d(2026, 5, 20),
      endDate: d(2026, 5, 24),
      maxCapacity: 30,
      status: SessionStatus.COMPLETED,
    }),
    await seedSession({
      programId: programs[1].id,
      title: 'Digital Skills Workshop – June',
      venue: 'TTRI Computer Lab',
      startDate: d(2026, 6, 10),
      endDate: d(2026, 6, 12),
      maxCapacity: 25,
      status: SessionStatus.COMPLETED,
    }),
    await seedSession({
      programId: programs[2].id,
      title: 'Project Management – July Cohort',
      venue: 'TTRI Training Room B',
      startDate: d(2026, 6, 30),
      endDate: d(2026, 7, 3),
      maxCapacity: 20,
      status: SessionStatus.ONGOING,
    }),
    await seedSession({
      programId: programs[3].id,
      title: 'Public Speaking Intensive – July',
      venue: 'TTRI Auditorium',
      startDate: d(2026, 7, 10),
      endDate: d(2026, 7, 11),
      maxCapacity: 40,
      status: SessionStatus.UPCOMING,
    }),
    await seedSession({
      programId: programs[4].id,
      title: 'Financial Management – August',
      venue: 'TTRI Training Room A',
      startDate: d(2026, 8, 4),
      endDate: d(2026, 8, 6),
      maxCapacity: 25,
      status: SessionStatus.UPCOMING,
    }),
    await seedSession({
      programId: programs[0].id,
      title: 'Leadership Development – Batch 2',
      venue: 'TTRI Conference Hall A',
      startDate: d(2026, 8, 17),
      endDate: d(2026, 8, 21),
      maxCapacity: 30,
      status: SessionStatus.UPCOMING,
    }),
  ];
  console.log(`  ✓ ${sessions.length} training sessions`);

  // ── Materials ────────────────────────────────────────────────────────────────
  const materialsEnabledSessions = new Set([sessions[0].id, sessions[1].id, sessions[2].id]);
  for (const session of sessions) {
    const enabled = materialsEnabledSessions.has(session.id);
    await prisma.trainingSession.update({ where: { id: session.id }, data: { materialsEnabled: enabled } });
    const existingMaterials = await prisma.sessionMaterial.count({ where: { sessionId: session.id } });
    if (existingMaterials > 0) continue;
    await prisma.sessionMaterial.createMany({
      data: [
        { sessionId: session.id, type: MaterialType.FILE, title: 'Course Slides (PDF)', value: '/materials/slides.pdf', order: 0 },
        { sessionId: session.id, type: MaterialType.LINK, title: 'Reference Reading List', value: 'https://example.org/reading-list', order: 1 },
        { sessionId: session.id, type: MaterialType.VIDEO, title: 'Welcome & Orientation', value: 'https://example.org/orientation.mp4', order: 2 },
      ],
    });
  }
  console.log('  ✓ session materials');

  // ── Agenda ───────────────────────────────────────────────────────────────────
  const AGENDA_TOPICS = [
    { time: ['08:00', '09:00'], topic: 'Registration & Opening Ceremony' },
    { time: ['09:00', '10:30'], topic: 'Session 1: Introduction & Fundamentals' },
    { time: ['10:45', '12:00'], topic: 'Session 2: Core Concepts' },
    { time: ['13:00', '14:30'], topic: 'Session 3: Practical Exercises' },
    { time: ['14:45', '16:00'], topic: 'Session 4: Group Discussion & Case Study' },
    { time: ['16:15', '17:00'], topic: 'Daily Recap & Q&A' },
  ];
  const CLOSING_TOPICS = [
    { time: ['08:00', '10:00'], topic: 'Final Assessment' },
    { time: ['10:15', '11:30'], topic: 'Presentation of Group Work' },
    { time: ['11:30', '12:00'], topic: 'Feedback Survey & Closing Ceremony' },
  ];
  const sessionProgramIdx = [0, 1, 2, 3, 4, 0];
  for (const [i, session] of sessions.entries()) {
    const existingAgenda = await prisma.sessionAgendaItem.count({ where: { sessionId: session.id } });
    if (existingAgenda > 0) continue;
    const durationDays = programs[sessionProgramIdx[i]].durationDays;
    const rows: { sessionId: number; day: number; timeFrom: string; timeTo: string; topic: string; facilitator: string; order: number }[] = [];
    let order = 0;
    for (let day = 1; day <= durationDays; day++) {
      const topics = day === durationDays && durationDays > 1 ? CLOSING_TOPICS : AGENDA_TOPICS;
      for (const t of topics) {
        rows.push({
          sessionId: session.id, day, timeFrom: t.time[0], timeTo: t.time[1],
          topic: t.topic, facilitator: trainers[i % trainers.length].fullName, order: order++,
        });
      }
    }
    await prisma.sessionAgendaItem.createMany({ data: rows });
  }
  console.log('  ✓ session agendas');

  // ── Assessments ──────────────────────────────────────────────────────────────
  const QUESTION_BANK: Record<AssessmentCategory, { text: string; options: string[]; correct: number }[]> = {
    [AssessmentCategory.PRE]: [
      { text: 'What is the primary goal of this training program?', options: ['To pass time', 'To build practical, job-relevant skills', 'To earn a vacation day', 'None of the above'], correct: 1 },
      { text: 'Effective preparation improves training outcomes.', options: ['True', 'False'], correct: 0 },
    ],
    [AssessmentCategory.POST]: [
      { text: 'Which approach best reflects what was covered in this training?', options: ['Ignoring feedback', 'Applying structured, evidence-based methods', 'Guessing', 'Avoiding collaboration'], correct: 1 },
      { text: 'Reflecting on lessons learned helps reinforce training outcomes.', options: ['True', 'False'], correct: 0 },
      { text: 'Which of these is a key takeaway skill from this course?', options: ['Practical application', 'Memorization only', 'None', 'Avoidance'], correct: 0 },
    ],
    [AssessmentCategory.EXAM]: [
      { text: "In a real work scenario, which best demonstrates mastery of this course's material?", options: ['Applying the concepts under real constraints', 'Reciting definitions only', 'Skipping the process', 'Delegating everything'], correct: 0 },
      { text: 'Certification requires demonstrating consistent, correct application of course concepts.', options: ['True', 'False'], correct: 0 },
      { text: 'Which best describes a well-executed outcome from this training?', options: ['Rushed and incomplete', 'Deliberate, well-documented, and reviewed', 'Undocumented', 'Delayed indefinitely'], correct: 1 },
    ],
  };
  const PASS_SCORE: Record<AssessmentCategory, number> = {
    [AssessmentCategory.PRE]: 50,
    [AssessmentCategory.POST]: 70,
    [AssessmentCategory.EXAM]: 75,
  };

  async function seedAssessment(sessionId: number, category: AssessmentCategory, enabled: boolean) {
    const existing = await prisma.sessionAssessment.findFirst({ where: { sessionId, category } });
    if (existing) return existing;
    const assessment = await prisma.sessionAssessment.create({
      data: { sessionId, category, passScore: PASS_SCORE[category], enabled },
    });
    for (const [qi, q] of QUESTION_BANK[category].entries()) {
      await prisma.assessmentQuestion.create({
        data: {
          assessmentId: assessment.id,
          type: q.options.length === 2 ? QuestionType.TRUE_FALSE : QuestionType.MULTIPLE_CHOICE,
          text: q.text,
          correctOption: String(q.correct),
          points: 1,
          order: qi,
          options: { createMany: { data: q.options.map((text, order) => ({ text, order })) } },
        },
      });
    }
    return assessment;
  }

  const sessionAssessments: Record<number, Partial<Record<AssessmentCategory, { id: number; passScore: number }>>> = {};
  const assessmentPlan: Record<number, { category: AssessmentCategory; enabled: boolean }[]> = {
    [sessions[0].id]: [
      { category: AssessmentCategory.PRE, enabled: true },
      { category: AssessmentCategory.POST, enabled: true },
      { category: AssessmentCategory.EXAM, enabled: true },
    ],
    [sessions[1].id]: [
      { category: AssessmentCategory.PRE, enabled: true },
      { category: AssessmentCategory.POST, enabled: true },
    ],
    [sessions[2].id]: [
      { category: AssessmentCategory.PRE, enabled: true },
    ],
    [sessions[3].id]: [
      { category: AssessmentCategory.PRE, enabled: false },
      { category: AssessmentCategory.POST, enabled: false },
    ],
    [sessions[4].id]: [
      { category: AssessmentCategory.PRE, enabled: false },
    ],
    [sessions[5].id]: [
      { category: AssessmentCategory.PRE, enabled: false },
      { category: AssessmentCategory.POST, enabled: false },
      { category: AssessmentCategory.EXAM, enabled: false },
    ],
  };
  let assessmentCount = 0;
  for (const session of sessions) {
    sessionAssessments[session.id] = {};
    for (const { category, enabled } of assessmentPlan[session.id]) {
      const a = await seedAssessment(session.id, category, enabled);
      sessionAssessments[session.id][category] = { id: a.id, passScore: a.passScore };
      assessmentCount++;
    }
  }
  console.log(`  ✓ ${assessmentCount} assessments (varying PRE/POST/EXAM combinations)`);

  // ── Survey questions ─────────────────────────────────────────────────────────
  const surveySessions: Record<number, boolean> = {
    [sessions[0].id]: true,
    [sessions[1].id]: true,
    [sessions[3].id]: false,
    [sessions[5].id]: false,
  };
  let surveyCount = 0;
  for (const [sessionIdStr, enabled] of Object.entries(surveySessions)) {
    const sessionId = Number(sessionIdStr);
    await prisma.trainingSession.update({ where: { id: sessionId }, data: { surveyEnabled: enabled } });
    const existingQuestions = await prisma.sessionSurveyQuestion.count({ where: { sessionId } });
    if (existingQuestions > 0) continue;
    await prisma.sessionSurveyQuestion.create({
      data: { sessionId, type: SurveyQuestionType.RATING, text: 'How would you rate this training overall?', required: true, order: 0 },
    });
    const q2 = await prisma.sessionSurveyQuestion.create({
      data: { sessionId, type: SurveyQuestionType.SINGLE_CHOICE, text: 'Would you recommend this training to a colleague?', required: true, order: 1 },
    });
    await prisma.surveyQuestionOption.createMany({
      data: [
        { questionId: q2.id, text: 'Yes', order: 0 },
        { questionId: q2.id, text: 'Maybe', order: 1 },
        { questionId: q2.id, text: 'No', order: 2 },
      ],
    });
    await prisma.sessionSurveyQuestion.create({
      data: { sessionId, type: SurveyQuestionType.OPEN_ENDED, text: 'What could we improve for next time?', required: false, order: 2 },
    });
    surveyCount++;
  }
  console.log(`  ✓ survey questions for ${surveyCount} sessions`);

  // ── Assign Trainers ──────────────────────────────────────────────────────────
  const trainerAssignments = [
    { userId: trainers[0].id, sessionId: sessions[0].id },
    { userId: trainers[1].id, sessionId: sessions[0].id },
    { userId: trainers[0].id, sessionId: sessions[1].id },
    { userId: trainers[2].id, sessionId: sessions[2].id },
    { userId: trainers[1].id, sessionId: sessions[3].id },
    { userId: trainers[2].id, sessionId: sessions[4].id },
    { userId: trainers[0].id, sessionId: sessions[5].id },
    { userId: trainers[1].id, sessionId: sessions[5].id },
  ];
  for (const t of trainerAssignments) {
    await prisma.trainerOnSession.upsert({
      where: { userId_sessionId: { userId: t.userId, sessionId: t.sessionId } },
      update: {},
      create: t,
    });
  }
  console.log(`  ✓ ${trainerAssignments.length} trainer assignments`);

  // ── Enrollments ──────────────────────────────────────────────────────────────
  const enrollmentData: Array<{
    userId: number;
    sessionId: number;
    status: EnrollmentStatus;
    score?: number;
  }> = [
    { userId: participants[0].id, sessionId: sessions[0].id, status: EnrollmentStatus.ATTENDED, score: 88 },
    { userId: participants[1].id, sessionId: sessions[0].id, status: EnrollmentStatus.ATTENDED, score: 75 },
    { userId: participants[2].id, sessionId: sessions[0].id, status: EnrollmentStatus.ATTENDED, score: 92 },
    { userId: participants[3].id, sessionId: sessions[0].id, status: EnrollmentStatus.ABSENT },
    { userId: participants[4].id, sessionId: sessions[0].id, status: EnrollmentStatus.ATTENDED, score: 80 },
    { userId: participants[5].id, sessionId: sessions[0].id, status: EnrollmentStatus.ATTENDED, score: 67 },
    { userId: participants[6].id, sessionId: sessions[0].id, status: EnrollmentStatus.ATTENDED, score: 71 },
    { userId: participants[7].id, sessionId: sessions[0].id, status: EnrollmentStatus.ABSENT },

    { userId: participants[0].id, sessionId: sessions[1].id, status: EnrollmentStatus.ATTENDED, score: 90 },
    { userId: participants[2].id, sessionId: sessions[1].id, status: EnrollmentStatus.ATTENDED, score: 85 },
    { userId: participants[4].id, sessionId: sessions[1].id, status: EnrollmentStatus.ATTENDED, score: 78 },
    { userId: participants[8].id, sessionId: sessions[1].id, status: EnrollmentStatus.ATTENDED, score: 95 },
    { userId: participants[9].id, sessionId: sessions[1].id, status: EnrollmentStatus.ATTENDED, score: 88 },
    { userId: participants[10].id, sessionId: sessions[1].id, status: EnrollmentStatus.ABSENT },

    { userId: participants[1].id, sessionId: sessions[2].id, status: EnrollmentStatus.ENROLLED },
    { userId: participants[3].id, sessionId: sessions[2].id, status: EnrollmentStatus.ENROLLED },
    { userId: participants[5].id, sessionId: sessions[2].id, status: EnrollmentStatus.ENROLLED },
    { userId: participants[7].id, sessionId: sessions[2].id, status: EnrollmentStatus.ENROLLED },
    { userId: participants[11].id, sessionId: sessions[2].id, status: EnrollmentStatus.ENROLLED },

    { userId: participants[0].id, sessionId: sessions[3].id, status: EnrollmentStatus.ENROLLED },
    { userId: participants[6].id, sessionId: sessions[3].id, status: EnrollmentStatus.ENROLLED },
    { userId: participants[8].id, sessionId: sessions[3].id, status: EnrollmentStatus.ENROLLED },
    { userId: participants[10].id, sessionId: sessions[3].id, status: EnrollmentStatus.ENROLLED },
  ];

  const enrollmentByKey = new Map<string, { id: number }>();
  for (const e of enrollmentData) {
    const enrollment = await prisma.enrollment.upsert({
      where: { userId_sessionId: { userId: e.userId, sessionId: e.sessionId } },
      update: {},
      create: e,
    });
    enrollmentByKey.set(`${e.userId}-${e.sessionId}`, enrollment);
  }
  console.log(`  ✓ ${enrollmentData.length} enrollments`);

  // ── Assessment & survey responses ───────────────────────────────────────────
  function scoreFor(base: number, jitter: number) {
    return Math.max(0, Math.min(100, Math.round(base + (Math.random() - 0.5) * jitter)));
  }

  async function seedAssessmentResponse(
    enrollmentId: number,
    assessment: { id: number; passScore: number },
    score: number,
  ) {
    const existing = await prisma.assessmentResponse.findUnique({
      where: { enrollmentId_assessmentId: { enrollmentId, assessmentId: assessment.id } },
    });
    if (existing) return;
    const questions = await prisma.assessmentQuestion.findMany({ where: { assessmentId: assessment.id } });
    const passing = score >= assessment.passScore;
    await prisma.assessmentResponse.create({
      data: {
        enrollmentId,
        assessmentId: assessment.id,
        score,
        answers: {
          createMany: {
            data: questions.map((q) => {
              const isCorrect = passing || Math.random() < 0.4;
              const optionCount = 2;
              const correct = q.correctOption ?? '0';
              const wrong = String((Number(correct) + 1) % optionCount);
              return { questionId: q.id, chosenOption: isCorrect ? correct : wrong, textAnswer: null, isCorrect };
            }),
          },
        },
      },
    });
  }

  let responseCount = 0;
  for (const e of enrollmentData) {
    const enrollment = enrollmentByKey.get(`${e.userId}-${e.sessionId}`);
    if (!enrollment) continue;
    const assessments = sessionAssessments[e.sessionId] ?? {};

    if (e.status === EnrollmentStatus.ATTENDED && e.score !== undefined) {
      if (assessments.PRE) {
        await seedAssessmentResponse(enrollment.id, assessments.PRE, scoreFor(e.score - 8, 20));
        responseCount++;
      }
      if (assessments.POST) {
        await seedAssessmentResponse(enrollment.id, assessments.POST, e.score);
        responseCount++;
      }
      if (assessments.EXAM) {
        await seedAssessmentResponse(enrollment.id, assessments.EXAM, scoreFor(e.score + 3, 10));
        responseCount++;
      }
      if (surveySessions[e.sessionId]) {
        const existingSurveyResponse = await prisma.surveyResponse.findUnique({
          where: { enrollmentId_sessionId: { enrollmentId: enrollment.id, sessionId: e.sessionId } },
        });
        const questions = existingSurveyResponse
          ? []
          : await prisma.sessionSurveyQuestion.findMany({ where: { sessionId: e.sessionId } });
        if (!existingSurveyResponse) {
          await prisma.surveyResponse.create({
            data: {
              enrollmentId: enrollment.id,
              sessionId: e.sessionId,
              answers: {
                createMany: {
                  data: questions.map((q) => {
                    if (q.type === SurveyQuestionType.RATING) return { questionId: q.id, rating: Math.max(3, Math.min(5, Math.round(e.score! / 20))), textAnswer: null, choices: null };
                    if (q.type === SurveyQuestionType.SINGLE_CHOICE) return { questionId: q.id, rating: null, textAnswer: null, choices: JSON.stringify([e.score! >= 80 ? 0 : 1]) };
                    return { questionId: q.id, rating: null, textAnswer: 'Great training, learned a lot.', choices: null };
                  }),
                },
              },
            },
          });
        }
      }
    } else if (e.status === EnrollmentStatus.ENROLLED && assessments.PRE) {
      await seedAssessmentResponse(enrollment.id, assessments.PRE, scoreFor(65, 25));
      responseCount++;
    }
  }
  console.log(`  ✓ ${responseCount} assessment/survey responses`);

  // ── Certificates ─────────────────────────────────────────────────────────────
  const attended = enrollmentData.filter((e) => e.status === EnrollmentStatus.ATTENDED);
  let certCount = 0;
  for (const e of attended) {
    const certNo = formatCertificateNo(e.sessionId, e.userId);
    await prisma.certificate.upsert({
      where: { certificateNo: certNo },
      update: {},
      create: {
        userId: e.userId,
        sessionId: e.sessionId,
        certificateNo: certNo,
        issuedAt: new Date('2026-07-01'),
      },
    });
    certCount++;
  }
  console.log(`  ✓ ${certCount} certificates`);

  console.log('\n✅ Seed complete.');
  void admin;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
