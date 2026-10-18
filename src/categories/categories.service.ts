import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.trainingCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async create(data: CreateCategoryDto) {
    const name = data.name.trim();
    const nameKh = data.nameKh?.trim() || null;

    const existing = await this.prisma.trainingCategory.findFirst({
      where: { name: { equals: name } },
    });
    if (existing) {
      throw new ConflictException({ error: `Category "${name}" already exists.` });
    }

    return this.prisma.trainingCategory.create({ data: { name, nameKh } });
  }
}
