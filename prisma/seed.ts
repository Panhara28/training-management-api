import 'dotenv/config';
import {
  PrismaClient, Role, Gender, SessionStatus, EnrollmentStatus,
  AssessmentCategory, QuestionType, SurveyQuestionType, MaterialType,
} from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';
import { issueCertificate } from '../src/lib/certificate-eligibility';

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
    update: {
      email: 'chhouk.titpanhara@moc.gov.kh',
      passwordHash: DEMO_PASSWORD_HASH,
      staffRoleId: adminStaffRole.id,
      isActive: true,
    },
    create: {
      username: 'admin',
      email: 'chhouk.titpanhara@moc.gov.kh',
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
      { username: 'chan.mony', fullName: 'Chan Mony', fullNameKh: 'ចាន់ មុនី', gender: Gender.FEMALE, email: 'chan.mony@gov.kh', deptIdx: 3 },
      { username: 'rina.pich', fullName: 'Rina Pich', fullNameKh: 'ពេជ្រ រីណា', gender: Gender.FEMALE, email: 'rina.pich@gov.kh', deptIdx: 0 },
      { username: 'vuth.leak', fullName: 'Vuth Leak', fullNameKh: 'វុធ លក្ខណ៍', gender: Gender.MALE, email: 'vuth.leak@gov.kh', deptIdx: 1 },
      { username: 'srey.mom', fullName: 'Srey Mom', fullNameKh: 'ស្រី មុំ', gender: Gender.FEMALE, email: 'srey.mom@gov.kh', deptIdx: 2 },
      { username: 'kosal.dim', fullName: 'Kosal Dim', fullNameKh: 'ឌីម កុសល', gender: Gender.MALE, email: 'kosal.dim@gov.kh', deptIdx: 4 },
      { username: 'pisey.tan', fullName: 'Pisey Tan', fullNameKh: 'តាន់ ពិសី', gender: Gender.FEMALE, email: 'pisey.tan@gov.kh', deptIdx: 0 },
      { username: 'bora.nuth', fullName: 'Bora Nuth', fullNameKh: 'នុត បូរ៉ា', gender: Gender.MALE, email: 'bora.nuth@gov.kh', deptIdx: 1 },
      { username: 'sreyroth.ly', fullName: 'Sreyroth Ly', fullNameKh: 'លី ស្រីរ័ត្ន', gender: Gender.FEMALE, email: 'sreyroth.ly@gov.kh', deptIdx: 3 },
      { username: 'makara.hen', fullName: 'Makara Hen', fullNameKh: 'ហេន មករា', gender: Gender.MALE, email: 'makara.hen@gov.kh', deptIdx: 2 },
      { username: 'sophea.ros', fullName: 'Sophea Ros', fullNameKh: 'រស់ សុភា', gender: Gender.FEMALE, email: 'sophea.ros@gov.kh', deptIdx: 4 },
      { username: 'virak.heng', fullName: 'Virak Heng', fullNameKh: 'ហេង វីរៈ', gender: Gender.MALE, email: 'virak.heng@gov.kh', deptIdx: 0 },
      { username: 'channary.im', fullName: 'Channary Im', fullNameKh: 'អ៊ឹម ចាន់ណារី', gender: Gender.FEMALE, email: 'channary.im@gov.kh', deptIdx: 1 },
    ].map((p, i) => {
      // Demo intake details, as the public registration form collects them.
      const profile = {
        fullNameKh: p.fullNameKh,
        gender: p.gender,
        phoneNumber: `012 ${String(300100 + i * 7).padStart(6, '0')}`,
        currentRole: ['Officer', 'Deputy Chief of Office', 'Chief of Office', 'Technical Officer'][i % 4],
        generalDepartment: ['General Department of Trade Promotion', 'General Department of Domestic Trade'][i % 2],
        departmentOffice: ['Phnom Penh Municipal Department of Commerce', 'Siem Reap Provincial Department of Commerce', 'Department of Export-Import'][i % 3],
      };
      return prisma.user.upsert({
        where: { username: p.username },
        update: { passwordHash: DEMO_PASSWORD_HASH, ...profile },
        create: {
          username: p.username,
          email: p.email,
          passwordHash: DEMO_PASSWORD_HASH,
          fullName: p.fullName,
          role: Role.PARTICIPANT,
          departmentId: departments[p.deptIdx].id,
          ...profile,
        },
      });
    }),
  );
  console.log(`  ✓ ${1 + trainers.length + participants.length} users`);

  // ── Training Categories ──────────────────────────────────────────────────────
  const categoryDefs = [
    { name: 'Leadership', nameKh: 'ភាពជាអ្នកដឹកនាំ' },
    { name: 'Technology', nameKh: 'បច្ចេកវិទ្យា' },
    { name: 'Management', nameKh: 'ការគ្រប់គ្រង' },
    { name: 'Communication', nameKh: 'ការប្រាស្រ័យទាក់ទង' },
    { name: 'Finance', nameKh: 'ហិរញ្ញវត្ថុ' },
  ];
  for (const c of categoryDefs) {
    await prisma.trainingCategory.upsert({ where: { name: c.name }, update: { nameKh: c.nameKh }, create: c });
  }
  console.log(`  ✓ ${categoryDefs.length} training categories`);

  // ── Training Programs ────────────────────────────────────────────────────────
  const programs = await Promise.all([
    prisma.trainingProgram.upsert({
      where: { code: 'LDP-01' },
      update: { titleKh: 'កម្មវិធីអភិវឌ្ឍភាពជាអ្នកដឹកនាំ' },
      create: {
        code: 'LDP-01',
        titleKh: 'កម្មវិធីអភិវឌ្ឍភាពជាអ្នកដឹកនាំ',
        title: 'Leadership Development Program',
        description: 'Develop essential leadership and management skills for mid-level officials.',
        category: 'Leadership',
        durationDays: 5,
      },
    }),
    prisma.trainingProgram.upsert({
      where: { code: 'DSW-02' },
      update: { titleKh: 'សិក្ខាសាលាជំនាញឌីជីថល' },
      create: {
        code: 'DSW-02',
        titleKh: 'សិក្ខាសាលាជំនាញឌីជីថល',
        title: 'Digital Skills Workshop',
        description: 'Practical training on digital tools, data literacy, and cybersecurity basics.',
        category: 'Technology',
        durationDays: 3,
      },
    }),
    prisma.trainingProgram.upsert({
      where: { code: 'PMF-03' },
      update: { titleKh: 'មូលដ្ឋានគ្រឹះនៃការគ្រប់គ្រងគម្រោង' },
      create: {
        code: 'PMF-03',
        titleKh: 'មូលដ្ឋានគ្រឹះនៃការគ្រប់គ្រងគម្រោង',
        title: 'Project Management Fundamentals',
        description: 'Foundations of project planning, execution, and monitoring using modern frameworks.',
        category: 'Management',
        durationDays: 4,
      },
    }),
    prisma.trainingProgram.upsert({
      where: { code: 'PSC-04' },
      update: { titleKh: 'ការនិយាយជាសាធារណៈ និងការប្រាស្រ័យទាក់ទង' },
      create: {
        code: 'PSC-04',
        titleKh: 'ការនិយាយជាសាធារណៈ និងការប្រាស្រ័យទាក់ទង',
        title: 'Public Speaking & Communication',
        description: 'Enhance oral presentation, writing, and stakeholder communication skills.',
        category: 'Communication',
        durationDays: 2,
      },
    }),
    prisma.trainingProgram.upsert({
      where: { code: 'FMB-05' },
      update: { titleKh: 'មូលដ្ឋានគ្រឹះនៃការគ្រប់គ្រងហិរញ្ញវត្ថុ' },
      create: {
        code: 'FMB-05',
        titleKh: 'មូលដ្ឋានគ្រឹះនៃការគ្រប់គ្រងហិរញ្ញវត្ថុ',
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
    programId: string; title: string; titleKh: string; venue: string; startDate: Date; endDate: Date;
    maxCapacity: number; status: SessionStatus;
  }) {
    const existing = await prisma.trainingSession.findFirst({ where: { title: data.title, programId: data.programId } });
    if (existing) {
      return existing.titleKh
        ? existing
        : prisma.trainingSession.update({ where: { id: existing.id }, data: { titleKh: data.titleKh } });
    }
    return prisma.trainingSession.create({ data });
  }

  const sessions = [
    await seedSession({
      programId: programs[0].id,
      title: 'Leadership Development – Batch 1', titleKh: 'ការអភិវឌ្ឍភាពជាអ្នកដឹកនាំ – វគ្គទី១',
      venue: 'TTRI Conference Hall A',
      startDate: d(2026, 5, 20),
      endDate: d(2026, 5, 24),
      maxCapacity: 30,
      status: SessionStatus.COMPLETED,
    }),
    await seedSession({
      programId: programs[1].id,
      title: 'Digital Skills Workshop – June', titleKh: 'សិក្ខាសាលាជំនាញឌីជីថល – ខែមិថុនា',
      venue: 'TTRI Computer Lab',
      startDate: d(2026, 6, 10),
      endDate: d(2026, 6, 12),
      maxCapacity: 25,
      status: SessionStatus.COMPLETED,
    }),
    await seedSession({
      programId: programs[2].id,
      title: 'Project Management – July Cohort', titleKh: 'ការគ្រប់គ្រងគម្រោង – ក្រុមខែកក្កដា',
      venue: 'TTRI Training Room B',
      startDate: d(2026, 6, 30),
      endDate: d(2026, 7, 3),
      maxCapacity: 20,
      status: SessionStatus.ONGOING,
    }),
    await seedSession({
      programId: programs[3].id,
      title: 'Public Speaking Intensive – July', titleKh: 'វគ្គខ្លីការនិយាយជាសាធារណៈ – ខែកក្កដា',
      venue: 'TTRI Auditorium',
      startDate: d(2026, 7, 10),
      endDate: d(2026, 7, 11),
      maxCapacity: 40,
      status: SessionStatus.UPCOMING,
    }),
    await seedSession({
      programId: programs[4].id,
      title: 'Financial Management – August', titleKh: 'ការគ្រប់គ្រងហិរញ្ញវត្ថុ – ខែសីហា',
      venue: 'TTRI Training Room A',
      startDate: d(2026, 8, 4),
      endDate: d(2026, 8, 6),
      maxCapacity: 25,
      status: SessionStatus.UPCOMING,
    }),
    await seedSession({
      programId: programs[0].id,
      title: 'Leadership Development – Batch 2', titleKh: 'ការអភិវឌ្ឍភាពជាអ្នកដឹកនាំ – វគ្គទី២',
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
    const rows: { sessionId: string; day: number; timeFrom: string; timeTo: string; topic: string; facilitator: string; order: number }[] = [];
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

  async function seedAssessment(sessionId: string, category: AssessmentCategory, enabled: boolean) {
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

  const sessionAssessments: Record<string, Partial<Record<AssessmentCategory, { id: string; passScore: number }>>> = {};
  const assessmentPlan: Record<string, { category: AssessmentCategory; enabled: boolean }[]> = {
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
  const surveySessions: Record<string, boolean> = {
    [sessions[0].id]: true,
    [sessions[1].id]: true,
    [sessions[3].id]: false,
    [sessions[5].id]: false,
  };
  let surveyCount = 0;
  for (const [sessionId, enabled] of Object.entries(surveySessions)) {
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
    userId: string;
    sessionId: string;
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

  const enrollmentByKey = new Map<string, { id: string }>();
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
    enrollmentId: string,
    assessment: { id: string; passScore: number },
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
    const userId_sessionId = { userId: e.userId, sessionId: e.sessionId };
    if (!(await prisma.certificate.findUnique({ where: { userId_sessionId } }))) {
      const certificate = await issueCertificate(prisma, e.userId, e.sessionId);
      if (certificate) {
        await prisma.certificate.update({ where: { id: certificate.id }, data: { issuedAt: new Date('2026-07-01') } });
      }
    }
    certCount++;
  }
  console.log(`  ✓ ${certCount} certificates`);

  console.log('\n✅ Seed complete.');
  void admin;
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
