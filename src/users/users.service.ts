import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../lib/crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(role?: string, departmentId?: string) {
    return this.prisma.user.findMany({
      where: {
        role: { not: 'PARTICIPANT' },
        ...(role ? { role: role as Role } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        staffRole: { select: { id: true, name: true, slug: true } },
        _count: { select: { enrollments: true, certificates: true, sessions: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async create(data: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username: data.username }, { email: data.email }] },
    });
    if (existing) throw new ConflictException({ error: 'Username or email is already in use.' });

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        fullName: data.fullName,
        fullNameKh: data.fullNameKh?.trim() || null,
        phoneNumber: data.phoneNumber?.trim() || null,
        generalDepartment: data.generalDepartment?.trim() || null,
        departmentOffice: data.departmentOffice?.trim() || null,
        currentRole: data.currentRole?.trim() || null,
        role: data.role,
        passwordHash: hashPassword(data.password),
        staffRoleId: data.staffRoleId ?? null,
        departmentId: data.departmentId ?? null,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        staffRole: { select: { id: true, name: true } },
      },
    });

    return user;
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        fullNameKh: true,
        generalDepartment: true,
        departmentOffice: true,
        currentRole: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        staffRole: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new NotFoundException({ error: 'Not found' });
    return user;
  }

  async update(id: string, body: UpdateUserDto, actingUserId: string) {
    if (Object.keys(body).length === 0) {
      throw new BadRequestException({ error: 'Nothing to update.' });
    }
    const deactivating = body.isActive === false;
    const demoting = body.role !== undefined && body.role !== 'ADMIN';
    if (id === actingUserId && (deactivating || demoting)) {
      throw new BadRequestException({ error: 'You cannot deactivate or change the role of your own account.' });
    }
    if (deactivating || demoting) await this.assertNotLastActiveAdmin(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.staffRoleId !== undefined ? { staffRoleId: body.staffRoleId } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
        ...(body.fullNameKh !== undefined ? { fullNameKh: body.fullNameKh } : {}),
        ...(body.generalDepartment !== undefined ? { generalDepartment: body.generalDepartment } : {}),
        ...(body.departmentOffice !== undefined ? { departmentOffice: body.departmentOffice } : {}),
        ...(body.currentRole !== undefined ? { currentRole: body.currentRole } : {}),
        ...(body.phoneNumber !== undefined ? { phoneNumber: body.phoneNumber } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        fullNameKh: true,
        generalDepartment: true,
        departmentOffice: true,
        currentRole: true,
        phoneNumber: true,
        role: true,
        isActive: true,
        staffRole: { select: { id: true, name: true } },
      },
    });

    return user;
  }

  async remove(id: string, actingUserId: string) {
    if (id === actingUserId) {
      throw new BadRequestException({ error: 'You cannot delete your own account.' });
    }
    await this.assertNotLastActiveAdmin(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  // At least one active ADMIN must always remain, or nobody can manage the system.
  private async assertNotLastActiveAdmin(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
    if (!user) throw new NotFoundException({ error: 'Not found' });
    if (user.role !== 'ADMIN' || !user.isActive) return;
    const activeAdmins = await this.prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (activeAdmins <= 1) {
      throw new BadRequestException({ error: 'At least one active administrator is required.' });
    }
  }
}
