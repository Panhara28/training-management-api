import { Prisma, type PrismaClient } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

// TTRI-<training running number>-<certificate running number within the training>
export function formatCertificateNo(sessionSerialNo: number, certificateSerialNo: number): string {
  return `TTRI-${String(sessionSerialNo).padStart(3, '0')}-${String(certificateSerialNo).padStart(4, '0')}`;
}

const MAX_SERIAL_ATTEMPTS = 5;

/**
 * Issues the participant's certificate for a session and returns it; returns the
 * existing one if it was already issued, or null if the session does not exist.
 * The certificate takes the next running number of its training. Two requests
 * racing for the same number are settled by the unique indexes: the loser retries.
 */
export async function issueCertificate(prisma: PrismaClient, userId: string, sessionId: string) {
  const userId_sessionId = { userId, sessionId };
  const existing = await prisma.certificate.findUnique({ where: { userId_sessionId } });
  if (existing) return existing;

  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId }, select: { serialNo: true } });
  if (!session) return null;

  for (let attempt = 1; ; attempt++) {
    const last = await prisma.certificate.aggregate({ where: { sessionId }, _max: { serialNo: true } });
    const serialNo = (last._max.serialNo ?? 0) + 1;
    try {
      return await prisma.certificate.create({
        data: { userId, sessionId, serialNo, certificateNo: formatCertificateNo(session.serialNo, serialNo) },
      });
    } catch (error) {
      const isUniqueViolation = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isUniqueViolation || attempt >= MAX_SERIAL_ATTEMPTS) throw error;
      const issuedMeanwhile = await prisma.certificate.findUnique({ where: { userId_sessionId } });
      if (issuedMeanwhile) return issuedMeanwhile;
    }
  }
}

/**
 * Issues a Certificate once a participant has passed every enabled POST/EXAM
 * assessment (if any) and submitted the survey (if enabled). Safe to call
 * redundantly from multiple trigger points — a participant gets one certificate per session.
 */
export async function checkAndIssueCertificateIfEligible(
  participantId: string,
  sessionId: string,
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

  return issueCertificate(prisma, participantId, sessionId);
}
