import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

// Maps Prisma's known request errors to proper HTTP responses instead of a
// generic 500 — e.g. a duplicate unique value, a missing record on
// update/delete, or deleting a row that other records still reference.
const PRISMA_ERRORS: Record<string, { status: number; error: string }> = {
  P2002: { status: HttpStatus.CONFLICT, error: 'A record with this value already exists.' },
  P2003: {
    status: HttpStatus.CONFLICT,
    error: 'This record is linked to other data and cannot be changed or removed.',
  },
  P2025: { status: HttpStatus.NOT_FOUND, error: 'Not found' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const mapped = PRISMA_ERRORS[exception.code];
    if (!mapped) {
      this.logger.error(exception.message, exception.stack);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
      return;
    }
    res.status(mapped.status).json({ error: mapped.error });
  }
}
