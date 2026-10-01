import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/staff-jwt';
import { createSessionToken } from '../lib/portal-session';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '../lib/rate-limit';
import { getMocOAuthClient, MOC_EMAIL_DOMAIN, resolvePkceState } from '../lib/moc-oauth';
import { staffMayUsePortal } from '../lib/portal-staff-access';
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

  // AAS login, step 2 — exchange the code AAS gave the browser for a local
  // session. Any existing, active user (admin, trainer or participant) with a
  // @moc.gov.kh email matches; participants get a portal session instead of a
  // staff one.
  //
  // When the sign-in was started from a public registration form, nothing is
  // looked up or signed in: the AAS profile is handed back to pre-fill the form.
  async mocOauthLogin(code: string, state: string, pkceCookie: string | undefined, ip: string) {
    const pkce = resolvePkceState(state, pkceCookie);
    if (!pkce) {
      throw new UnauthorizedException({ error: 'Invalid or expired login session. Please try again.' });
    }

    const result = await getMocOAuthClient().validateAuthorizationCode({ code, codeVerifier: pkce.codeVerifier });
    if (!result.success || !result.data.isValid || !result.data.payload) {
      await this.audit.log({ userId: null, action: 'auth.moc_oauth.failed', ipAddress: ip });
      throw new UnauthorizedException({ error: 'AAS authentication failed. Please try again.' });
    }

    if (pkce.registerFor) {
      const profile = result.data.payload;
      return {
        kind: 'registration' as const,
        sessionId: pkce.registerFor,
        // AAS has no department/office fields; the participant fills those in.
        profile: {
          fullName: profile.fullNameEn ?? '',
          fullNameKh: profile.fullNameKm ?? '',
          currentRole: profile.position ?? '',
          email: profile.email?.toLowerCase() ?? '',
          phoneNumber: profile.phoneNumber ?? '',
        },
      };
    }

    const email = result.data.payload.email?.toLowerCase();
    if (!email || !email.endsWith(MOC_EMAIL_DOMAIN)) {
      throw new ForbiddenException({ error: `Only ${MOC_EMAIL_DOMAIN} accounts can sign in with AAS.` });
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await this.audit.log({ userId: null, action: 'auth.moc_oauth.failed', ipAddress: ip });
      throw new ForbiddenException({
        error: 'No local account found for this email. Ask an admin to create your account first.',
      });
    }
    if (!user.isActive) {
      throw new ForbiddenException({ error: 'User is not active.' });
    }

    await this.audit.log({ userId: user.id, action: 'auth.moc_oauth.success', ipAddress: ip });

    const publicUser = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    // A staff member allowed onto the portal gets a participant session when
    // they sign in from the participant login page, and a staff one otherwise.
    const asParticipant = user.role === 'PARTICIPANT' || (pkce.fromPortal && staffMayUsePortal(user.email));
    if (asParticipant) {
      return { kind: 'portal' as const, portalToken: createSessionToken(user.id, 'PARTICIPANT'), user: publicUser };
    }
    return {
      kind: 'staff' as const,
      accessToken: signAccessToken(user.id, user.staffRoleId),
      refreshToken: signRefreshToken(user.id),
      user: publicUser,
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

  async me(userId: string | null) {
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
