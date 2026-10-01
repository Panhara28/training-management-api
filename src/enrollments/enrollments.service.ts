import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(sessionId?: string, userId?: string) {
    return this.prisma.enrollment.findMany({
      where: {
        ...(sessionId ? { sessionId } : {}),
        ...(userId ? { userId } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        session: { select: { id: true, title: true, startDate: true, endDate: true, status: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async create(data: CreateEnrollmentDto) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id: data.sessionId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!session) throw new NotFoundException({ error: 'Session not found' });
    const user = await this.prisma.user.findUnique({ where: { id: data.userId }, select: { id: true } });
    if (!user) throw new NotFoundException({ error: 'Participant not found' });
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_sessionId: { userId: user.id, sessionId: session.id } },
    });
    if (existing) throw new ConflictException({ error: 'Participant is already enrolled in this session' });
    // maxCapacity 0 means no limit — same rule as public registration.
    if (session.maxCapacity > 0 && session._count.enrollments >= session.maxCapacity) {
      throw new ConflictException({ error: 'Session is at full capacity' });
    }

    return this.prisma.enrollment.create({
      data: { userId: data.userId, sessionId: data.sessionId },
      include: {
        user: { select: { fullName: true } },
        session: { select: { title: true } },
      },
    });
  }

  update(data: UpdateEnrollmentDto) {
    return this.prisma.enrollment.update({
      where: { id: data.id },
      data: { status: data.status, ...(data.score !== undefined ? { score: data.score } : {}) },
    });
  }
}
