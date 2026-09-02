import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.trainingProgram.findMany({
      include: { _count: { select: { sessions: true } } },
      orderBy: { title: 'asc' },
    });
  }

  create(data: CreateProgramDto) {
    return this.prisma.trainingProgram.create({
      data: {
        code: data.code,
        title: data.title,
        description: data.description,
        category: data.category,
        durationDays: Number(data.durationDays),
      },
    });
  }
}
