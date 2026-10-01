import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { verifyPassword } from '../lib/crypto';
import { createSessionToken } from '../lib/portal-session';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '../lib/rate-limit';

@Injectable()
export class PortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async login(username: string, password: string, ip: string) {
    const key = `portal:${username}`;
    const rateLimit = await checkRateLimit(this.prisma, ip, key);
    if (rateLimit.blocked) {
      throw new HttpException({ error: 'Too many login attempts. Please try again later.' }, 429);
    }

    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user || user.role !== 'PARTICIPANT' || !verifyPassword(password, user.passwordHash)) {
      await recordFailedAttempt(this.prisma, ip, key);
      throw new UnauthorizedException({ error: 'Invalid username or password.' });
    }

    await clearAttempts(this.prisma, ip, key);
    await this.audit.log({ userId: user.id, action: 'portal.login.success', ipAddress: ip });

    return {
      token: createSessionToken(user.id, user.role),
      user: { id: user.id, username: user.username, fullName: user.fullName, email: user.email },
    };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        department: { select: { name: true } },
        _count: { select: { enrollments: true, certificates: true } },
      },
    });
  }
}
