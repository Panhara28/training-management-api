import type { PrismaService } from '../prisma/prisma.service';

const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function checkRateLimit(prisma: PrismaService, ip: string, username: string): Promise<{ blocked: boolean }> {
  const key = `${ip}:${username}`;
  const attempt = await prisma.loginAttempt.findUnique({ where: { key } });
  if (!attempt) return { blocked: false };

  const withinWindow = Date.now() - attempt.firstAttemptAt.getTime() < RATE_LIMIT_WINDOW_MS;
  return { blocked: withinWindow && attempt.count >= MAX_ATTEMPTS };
}

export async function recordFailedAttempt(prisma: PrismaService, ip: string, username: string): Promise<void> {
  const key = `${ip}:${username}`;
  const attempt = await prisma.loginAttempt.findUnique({ where: { key } });

  if (!attempt || Date.now() - attempt.firstAttemptAt.getTime() >= RATE_LIMIT_WINDOW_MS) {
    await prisma.loginAttempt.upsert({
      where: { key },
      update: { count: 1, firstAttemptAt: new Date() },
      create: { key, count: 1 },
    });
  } else {
    await prisma.loginAttempt.update({ where: { key }, data: { count: { increment: 1 } } });
  }
}

export async function clearAttempts(prisma: PrismaService, ip: string, username: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: `${ip}:${username}` } });
}

export function getClientIp(headers: Record<string, string | string[] | undefined>, fallback?: string): string {
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    const value = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return value.split(',')[0].trim();
  }
  return fallback ?? 'unknown';
}
