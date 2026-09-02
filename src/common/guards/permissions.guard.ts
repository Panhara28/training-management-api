import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRE_PERMISSION_KEY, type RequiredPermission } from '../decorators/require-permission.decorator';
import type { AuthenticatedStaff } from '../interfaces/authenticated-staff.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request & { staff?: AuthenticatedStaff }>();
    const staff = req.staff;
    if (!staff?.staffRoleId) {
      throw new ForbiddenException('No role assigned to your account.');
    }

    const permission = await this.prisma.staffRolePermission.findFirst({
      where: { staffRoleId: staff.staffRoleId, module: { name: required.module } },
    });
    if (!permission || !permission[required.action]) {
      throw new ForbiddenException(`Missing permission: ${required.module}:${required.action}`);
    }

    return true;
  }
}
