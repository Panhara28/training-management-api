import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createProgramWithGeneratedCode, previewProgramCode } from '../lib/program-code';
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

  nextCode(category: string) {
    return previewProgramCode(this.prisma, category).then((code) => ({ code }));
  }

  async create(data: CreateProgramDto) {
    await this.ensureCategoryExists(data.category);
    return createProgramWithGeneratedCode(this.prisma, data.category, {
      title: data.title,
      titleKh: data.titleKh?.trim() || null,
      description: data.description,
      durationDays: Number(data.durationDays),
    });
  }

  // Keeps the category lookup table authoritative even for callers that
  // still pass a free-form category string.
  private async ensureCategoryExists(category: string) {
    const name = category.trim();
    const existing = await this.prisma.trainingCategory.findFirst({ where: { name: { equals: name } } });
    if (!existing) {
      await this.prisma.trainingCategory.create({ data: { name } });
    }
  }
}
