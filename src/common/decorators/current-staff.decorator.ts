import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedStaff } from '../interfaces/authenticated-staff.interface';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedStaff => {
    const req = ctx.switchToHttp().getRequest<Request & { staff?: AuthenticatedStaff }>();
    return req.staff as AuthenticatedStaff;
  },
);
