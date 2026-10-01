import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { verifySessionToken, SESSION_COOKIE } from '../../lib/portal-session';
import { staffMayUsePortal } from '../../lib/portal-staff-access';
import type { User } from '@prisma/client';

@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { participant?: User }>();
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
    const payload = verifySessionToken(token);
    if (!payload || payload.role !== 'PARTICIPANT') {
      throw new UnauthorizedException('Authentication required.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || (user.role !== 'PARTICIPANT' && !staffMayUsePortal(user.email))) {
      throw new UnauthorizedException('Authentication required.');
    }

    req.participant = user;
    return true;
  }
}
