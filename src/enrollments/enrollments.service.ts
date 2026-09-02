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
        ...(sessionId ? { sessionId: Number(sessionId) } : {}),
        ...(userId ? { userId: Number(userId) } : {}),
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
      where: { id: Number(data.sessionId) },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!session) throw new NotFoundException({ error: 'Session not found' });
    if (session._count.enrollments >= session.maxCapacity) {
      throw new ConflictException({ error: 'Session is at full capacity' });
    }

    return this.prisma.enrollment.create({
      data: { userId: Number(data.userId), sessionId: Number(data.sessionId) },
      include: {
        user: { select: { fullName: true } },
        session: { select: { title: true } },
      },
    });
  }

  update(data: UpdateEnrollmentDto) {
    return this.prisma.enrollment.update({
      where: { id: Number(data.id) },
      data: { status: data.status, ...(data.score !== undefined ? { score: data.score } : {}) },
    });
  }
}
