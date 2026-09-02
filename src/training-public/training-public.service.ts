import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../lib/crypto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class TrainingPublicService {
  constructor(private readonly prisma: PrismaService) {}

  private async uniqueUsernameFromEmail(email: string): Promise<string> {
    const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '') || 'participant';
    let candidate = base;
    let suffix = 1;
    while (await this.prisma.user.findUnique({ where: { username: candidate } })) {
      candidate = `${base}${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  async register(sessionId: number, body: RegisterDto) {
    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!trainingSession) throw new NotFoundException({ error: 'Training not found.' });
    if (trainingSession.publishStatus !== 'PUBLISHED') {
      throw new ForbiddenException({ error: 'Registration is not open for this training.' });
    }
    if (trainingSession.maxCapacity > 0 && trainingSession._count.enrollments >= trainingSession.maxCapacity) {
      throw new ConflictException({ error: 'This training is full.' });
    }

    const email = body.email.trim().toLowerCase();

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.role !== 'PARTICIPANT') {
      throw new ConflictException({ error: 'This email is already associated with a staff account.' });
    }

    if (!user) {
      const username = await this.uniqueUsernameFromEmail(email);
      user = await this.prisma.user.create({
        data: {
          username,
          email,
          fullName: body.fullName.trim(),
          fullNameKh: body.fullNameKh.trim(),
          generalDepartment: body.generalDepartment.trim(),
          departmentOffice: body.departmentOffice.trim(),
          currentRole: body.currentRole.trim(),
          phoneNumber: body.phoneNumber.trim(),
          // No login is issued for self-registration; this satisfies the required
          // column with a hash nobody can derive a matching password for.
          passwordHash: hashPassword(randomBytes(32).toString('hex')),
          role: 'PARTICIPANT',
        },
      });
    }

    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: { userId_sessionId: { userId: user.id, sessionId } },
    });
    if (existingEnrollment) {
      throw new ConflictException({ error: 'You are already registered for this training.' });
    }

    await this.prisma.enrollment.create({
      data: { userId: user.id, sessionId, status: 'ENROLLED' },
    });

    return { ok: true };
  }
}
