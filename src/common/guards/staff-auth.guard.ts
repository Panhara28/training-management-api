import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyAccessToken, ACCESS_COOKIE } from '../../lib/staff-jwt';
import type { AuthenticatedStaff } from '../interfaces/authenticated-staff.interface';

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { staff?: AuthenticatedStaff }>();
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[ACCESS_COOKIE];
    const payload = verifyAccessToken(token);
    if (!payload) throw new UnauthorizedException('Authentication required.');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, role: true },
    });
    if (!user || !user.isActive || user.role === 'PARTICIPANT') {
      throw new UnauthorizedException('Authentication required.');
    }

    req.staff = { userId: payload.sub, staffRoleId: payload.staffRoleId, role: user.role };
    return true;
  }
}
