import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStaff } from '../common/interfaces/authenticated-staff.interface';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [totalPrograms, totalSessions, totalParticipants, totalCertificates, upcomingSessions, recentSessions] =
      await Promise.all([
        this.prisma.trainingProgram.count(),
        this.prisma.trainingSession.count(),
        this.prisma.user.count({ where: { role: 'PARTICIPANT' } }),
        this.prisma.certificate.count(),
        this.prisma.trainingSession.count({ where: { status: 'UPCOMING' } }),
        this.prisma.trainingSession.findMany({
          take: 5,
          orderBy: { startDate: 'desc' },
          include: {
            program: { select: { code: true, title: true, category: true } },
            _count: { select: { enrollments: true } },
          },
        }),
      ]);

    return {
      totalPrograms,
      totalSessions,
      totalParticipants,
      totalCertificates,
      upcomingSessions,
      recentSessions,
    };
  }

  private async getAssignedSessionIds(userId: number): Promise<number[]> {
    const rows = await this.prisma.trainerOnSession.findMany({ where: { userId }, select: { sessionId: true } });
    return rows.map((r) => r.sessionId);
  }

  /** Trainer-scoped overview for the admin dashboard page. */
  async dashboardOverview(staff: AuthenticatedStaff) {
    const isTrainer = staff.role === 'TRAINER';
    const assignedIds = isTrainer ? await this.getAssignedSessionIds(staff.userId) : null;
    const sessionFilter = assignedIds ? { id: { in: assignedIds } } : {};
    const sessionIdFilter = assignedIds ? { sessionId: { in: assignedIds } } : {};

    const [
      totalTrainings,
      activeParticipants,
      certificatesIssued,
      upcomingSessions,
      recentSessions,
      sessionStatusCounts,
      enrollmentStatusCounts,
      sessionsWithProgram,
      assessmentResponses,
      enrollmentsByMonth,
    ] = await Promise.all([
      this.prisma.trainingSession.count({ where: sessionFilter }),
      assignedIds
        ? this.prisma.enrollment
            .findMany({ where: sessionIdFilter, select: { userId: true }, distinct: ['userId'] })
            .then((rows) => rows.length)
        : this.prisma.user.count({ where: { role: 'PARTICIPANT' } }),
      this.prisma.certificate.count({ where: sessionIdFilter }),
      this.prisma.trainingSession.count({ where: { ...sessionFilter, status: 'UPCOMING' } }),
      this.prisma.trainingSession.findMany({
        where: sessionFilter,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { enrollments: true } } },
      }),
      this.prisma.trainingSession.groupBy({ by: ['status'], where: sessionFilter, _count: true }),
      this.prisma.enrollment.groupBy({ by: ['status'], where: sessionIdFilter, _count: true }),
      this.prisma.trainingSession.findMany({
        where: sessionFilter,
        include: { program: { select: { category: true } }, _count: { select: { enrollments: true } } },
      }),
      this.prisma.assessmentResponse.findMany({
        where: assignedIds ? { enrollment: { sessionId: { in: assignedIds } } } : {},
        include: { assessment: { select: { category: true, passScore: true } } },
      }),
      this.prisma.enrollment.findMany({ where: sessionIdFilter, select: { enrolledAt: true } }),
    ]);

    const statusColors: Record<string, string> = {
      ONGOING: 'bg-blue-100 text-blue-700',
      COMPLETED: 'bg-green-100 text-green-700',
      UPCOMING: 'bg-amber-100 text-amber-700',
      CANCELLED: 'bg-slate-100 text-slate-600',
    };

    const recentTrainings = recentSessions.map((s) => ({
      name: s.title,
      date: s.startDate.toISOString(),
      participants: s._count.enrollments,
      statusKey: s.status,
      statusColor: statusColors[s.status],
    }));

    const sessionStatusData = sessionStatusCounts.map((s) => ({ status: s.status, count: s._count }));

    const categoryMap = new Map<string, { category: string; sessions: number; enrolled: number }>();
    for (const s of sessionsWithProgram) {
      const cat = s.program.category;
      const existing = categoryMap.get(cat);
      if (existing) {
        existing.sessions += 1;
        existing.enrolled += s._count.enrollments;
      } else {
        categoryMap.set(cat, { category: cat, sessions: 1, enrolled: s._count.enrollments });
      }
    }
    const sessionsByCategory = Array.from(categoryMap.values());

    const monthlyEnroll = new Map<string, number>();
    for (const e of enrollmentsByMonth) {
      const month = e.enrolledAt.toISOString().slice(0, 7);
      monthlyEnroll.set(month, (monthlyEnroll.get(month) ?? 0) + 1);
    }
    const enrollmentTrend = Array.from(monthlyEnroll.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({ month, count }));

    const assessMap = new Map<string, { scores: number[]; passScore: number }>();
    for (const ar of assessmentResponses) {
      const cat = ar.assessment.category;
      const existing = assessMap.get(cat);
      if (existing) existing.scores.push(ar.score);
      else assessMap.set(cat, { scores: [ar.score], passScore: ar.assessment.passScore });
    }
    const assessmentPassRates = Array.from(assessMap.entries()).map(([category, { scores, passScore }]) => ({
      category,
      avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      passRate: Math.round((scores.filter((s) => s >= passScore).length / scores.length) * 100),
    }));

    const attendedCount = enrollmentStatusCounts.find((e) => e.status === 'ATTENDED')?._count ?? 0;
    const totalEnrollments = enrollmentsByMonth.length;
    const avgAttendance = totalEnrollments > 0 ? Math.round((attendedCount / totalEnrollments) * 100) : 0;
    const overallPassRate =
      assessmentResponses.length > 0
        ? Math.round(
            (assessmentResponses.filter((ar) => ar.score >= ar.assessment.passScore).length /
              assessmentResponses.length) *
              100,
          )
        : 0;

    return {
      stats: {
        totalTrainings,
        activeParticipants,
        certificatesIssued,
        upcomingSessions,
      },
      avgAttendance,
      overallPassRate,
      recentTrainings,
      sessionStatusData,
      sessionsByCategory,
      enrollmentTrend,
      assessmentPassRates,
    };
  }

  /** Org-wide (unscoped) aggregate report for the reports page. */
  async reportsOverview() {
    const [
      sessionStatusCounts,
      enrollmentStatusCounts,
      sessionsWithProgram,
      certificatesByDept,
      assessmentResponses,
      surveyAnswers,
      enrollmentsByMonth,
      certificatesByMonth,
    ] = await Promise.all([
      this.prisma.trainingSession.groupBy({ by: ['status'], _count: true }),
      this.prisma.enrollment.groupBy({ by: ['status'], _count: true }),
      this.prisma.trainingSession.findMany({
        include: { program: { select: { category: true, code: true } }, _count: { select: { enrollments: true } } },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.certificate.findMany({ include: { user: { include: { department: true } } } }),
      this.prisma.assessmentResponse.findMany({ include: { assessment: { select: { category: true, passScore: true } } } }),
      this.prisma.surveyAnswer.findMany({ where: { rating: { not: null } }, select: { rating: true } }),
      this.prisma.enrollment.findMany({ select: { enrolledAt: true } }),
      this.prisma.certificate.findMany({ select: { issuedAt: true } }),
    ]);

    const sessionStatusData = sessionStatusCounts.map((s) => ({ status: s.status, count: s._count }));
    const enrollmentStatusData = enrollmentStatusCounts.map((e) => ({ status: e.status, count: e._count }));

    const sessionsByCategory = Array.from(
      new Map(
        sessionsWithProgram
          .reduce(
            (acc, s) => {
              const existing = acc.find((x) => x.programCategory === s.program.category);
              if (existing) {
                existing.count += 1;
                existing.enrolled += s._count.enrollments;
              } else {
                acc.push({ programCategory: s.program.category, count: 1, enrolled: s._count.enrollments });
              }
              return acc;
            },
            [] as { programCategory: string; count: number; enrolled: number }[],
          )
          .map((x) => [x.programCategory, x] as const),
      ).values(),
    );

    const topSessions = [...sessionsWithProgram]
      .sort((a, b) => b._count.enrollments - a._count.enrollments)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        title: s.title,
        category: s.program.category,
        enrolled: s._count.enrollments,
        status: s.status,
      }));

    const deptCertMap = new Map<string, number>();
    certificatesByDept.forEach((cert) => {
      const deptName = cert.user.department?.name ?? 'Unknown';
      deptCertMap.set(deptName, (deptCertMap.get(deptName) ?? 0) + 1);
    });
    const certificatesByDeptData = Array.from(deptCertMap.entries()).map(([department, count]) => ({
      department,
      count,
    }));

    const assessmentByCategory = Array.from(
      new Map(
        assessmentResponses
          .reduce(
            (acc, ar) => {
              const existing = acc.find((x) => x.category === ar.assessment.category);
              if (existing) existing.scores.push(ar.score);
              else acc.push({ category: ar.assessment.category, scores: [ar.score], passScore: ar.assessment.passScore });
              return acc;
            },
            [] as { category: string; scores: number[]; passScore: number }[],
          )
          .map(
            (x) =>
              [
                x.category,
                {
                  category: x.category,
                  avgScore: Math.round((x.scores.reduce((a, b) => a + b, 0) / x.scores.length) * 100) / 100,
                  passRate: Math.round((x.scores.filter((s) => s >= x.passScore).length / x.scores.length) * 100),
                  count: x.scores.length,
                },
              ] as const,
          ),
      ).values(),
    );

    const avgSurveyRating =
      surveyAnswers.length > 0
        ? (surveyAnswers.reduce((a, s) => a + (s.rating ?? 0), 0) / surveyAnswers.length).toFixed(1)
        : '0';

    const preScores = assessmentResponses.filter((ar) => ar.assessment.category === 'PRE').map((ar) => ar.score);
    const postScores = assessmentResponses.filter((ar) => ar.assessment.category === 'POST').map((ar) => ar.score);
    const preAvg = preScores.length > 0 ? preScores.reduce((a, b) => a + b, 0) / preScores.length : 0;
    const postAvg = postScores.length > 0 ? postScores.reduce((a, b) => a + b, 0) / postScores.length : 0;
    const improvement = Math.round((postAvg - preAvg) * 100) / 100;

    const monthlyEnroll = enrollmentsByMonth.reduce((acc, e) => {
      const month = e.enrolledAt.toISOString().slice(0, 7);
      acc.set(month, (acc.get(month) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
    const enrollmentTrendData = Array.from(monthlyEnroll.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    const monthlyCert = certificatesByMonth.reduce((acc, c) => {
      const month = c.issuedAt.toISOString().slice(0, 7);
      acc.set(month, (acc.get(month) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
    const certificateTrendData = Array.from(monthlyCert.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    return {
      sessionStatusData,
      enrollmentStatusData,
      sessionsByCategory,
      topSessions,
      certificatesByDeptData,
      assessmentByCategory,
      avgSurveyRating,
      improvement,
      enrollmentTrendData,
      certificateTrendData,
      totalSessions: sessionsWithProgram.length,
      totalEnrollments: enrollmentsByMonth.length,
      totalCertificates: certificatesByDept.length,
      avgAttendance: Math.round(
        ((enrollmentStatusCounts.find((e) => e.status === 'ATTENDED')?._count ?? 0) / (enrollmentsByMonth.length || 1)) * 100,
      ),
    };
  }
}
