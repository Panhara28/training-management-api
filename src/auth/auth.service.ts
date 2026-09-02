import { BadRequestException, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/staff-jwt';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '../lib/rate-limit';
import type { AuthenticatedStaff } from '../common/interfaces/authenticated-staff.interface';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async login(username: string, password: string, ip: string) {
    const rateLimit = await checkRateLimit(this.prisma, ip, username);
    if (rateLimit.blocked) {
      throw new HttpException({ error: 'Too many login attempts. Please try again later.' }, 429);
    }

    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user || user.role === 'PARTICIPANT' || !verifyPassword(password, user.passwordHash) || !user.isActive) {
      await recordFailedAttempt(this.prisma, ip, username);
      await this.audit.log({ userId: user?.id ?? null, action: 'auth.login.failed', ipAddress: ip });
      throw new UnauthorizedException({ error: 'Invalid username or password.' });
    }

    await clearAttempts(this.prisma, ip, username);
    await this.audit.log({ userId: user.id, action: 'auth.login.success', ipAddress: ip });

    return {
      accessToken: signAccessToken(user.id, user.staffRoleId),
      refreshToken: signRefreshToken(user.id),
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
    };
  }

  async refresh(refreshToken: string | undefined) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) throw new UnauthorizedException({ error: 'Invalid refresh token' });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.role === 'PARTICIPANT') {
      throw new UnauthorizedException({ error: 'User not found or inactive' });
    }

    return { accessToken: signAccessToken(user.id, user.staffRoleId) };
  }

  async me(userId: number | null) {
    if (userId === null) return { user: null, permissions: {} };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        staffRole: {
          select: { id: true, name: true, slug: true, permissions: { include: { module: true } } },
        },
      },
    });
    if (!user) return { user: null, permissions: {} };

    const permissions: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }> = {};
    user.staffRole?.permissions.forEach((p) => {
      permissions[p.module.name] = { create: p.create, read: p.read, update: p.update, delete: p.delete };
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        staffRole: user.staffRole ? { name: user.staffRole.name, slug: user.staffRole.slug } : null,
      },
      permissions,
    };
  }

  async changePassword(staff: AuthenticatedStaff, body: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: staff.userId } });
    if (!user || !verifyPassword(body.currentPassword, user.passwordHash)) {
      throw new BadRequestException({ error: 'Current password is incorrect.' });
    }

    await this.prisma.user.update({
      where: { id: staff.userId },
      data: { passwordHash: hashPassword(body.newPassword) },
    });
    await this.audit.log({ userId: staff.userId, action: 'auth.change_password' });

    return { message: 'Password changed successfully.' };
  }
}
