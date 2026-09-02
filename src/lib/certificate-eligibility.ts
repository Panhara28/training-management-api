import type { PrismaService } from '../prisma/prisma.service';

export function formatCertificateNo(sessionId: number, participantId: number): string {
  return `TTRI-${String(sessionId).padStart(3, '0')}-${String(participantId).padStart(4, '0')}`;
}

/**
 * Issues a Certificate once a participant has passed every enabled POST/EXAM
 * assessment (if any) and submitted the survey (if enabled). Safe to call
 * redundantly from multiple trigger points — upserts on the unique certificateNo.
 */
export async function checkAndIssueCertificateIfEligible(
  participantId: number,
  sessionId: number,
  prisma: PrismaService,
) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_sessionId: { userId: participantId, sessionId } },
  });
  if (!enrollment) return null;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      surveyEnabled: true,
      assessments: { where: { enabled: true, category: { in: ['POST', 'EXAM'] } } },
    },
  });
  if (!session) return null;

  const requiredAssessments = session.assessments;
  const requiresSurvey = session.surveyEnabled;

  if (requiredAssessments.length === 0 && !requiresSurvey) return null;

  for (const assessment of requiredAssessments) {
    const response = await prisma.assessmentResponse.findUnique({
      where: { enrollmentId_assessmentId: { enrollmentId: enrollment.id, assessmentId: assessment.id } },
    });
    if (!response || response.score < assessment.passScore) return null;
  }

  if (requiresSurvey) {
    const surveyResponse = await prisma.surveyResponse.findUnique({
      where: { enrollmentId_sessionId: { enrollmentId: enrollment.id, sessionId } },
    });
    if (!surveyResponse) return null;
  }

  if (enrollment.status !== 'ATTENDED') {
    await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: 'ATTENDED' } });
  }

  const certificateNo = formatCertificateNo(sessionId, participantId);
  return prisma.certificate.upsert({
    where: { certificateNo },
    update: {},
    create: { userId: participantId, sessionId, certificateNo },
  });
}
