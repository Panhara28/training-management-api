import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AssignUsersDto } from './dto/assign-users.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.staffRole.findMany({
      include: {
        _count: { select: { users: true } },
        permissions: { include: { module: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: CreateRoleDto) {
    const existing = await this.prisma.staffRole.findFirst({
      where: { OR: [{ name: data.name }, { slug: data.slug }] },
    });
    if (existing) throw new ConflictException({ error: 'Role name or slug already exists.' });

    const role = await this.prisma.staffRole.create({
      data: { name: data.name, slug: data.slug, description: data.description ?? null },
    });

    const modules = await this.prisma.permissionModule.findMany({ select: { id: true } });
    if (modules.length > 0) {
      await this.prisma.staffRolePermission.createMany({
        data: modules.map((m) => ({ staffRoleId: role.id, moduleId: m.id })),
      });
    }

    return role;
  }

  async detail(id: string) {
    const role = await this.prisma.staffRole.findUnique({
      where: { id },
      include: { permissions: { include: { module: true } } },
    });
    if (!role) throw new NotFoundException({ error: 'Role not found.' });
    return role;
  }

  async update(id: string, data: UpdateRoleDto) {
    const role = await this.prisma.staffRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException({ error: 'Role not found.' });

    return this.prisma.staffRole.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });
  }

  async updatePermissions(id: string, data: UpdateRolePermissionsDto) {
    const role = await this.prisma.staffRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException({ error: 'Role not found.' });

    await this.prisma.$transaction(
      data.permissions.map((p) =>
        this.prisma.staffRolePermission.upsert({
          where: { staffRoleId_moduleId: { staffRoleId: id, moduleId: p.moduleId } },
          update: { create: p.create, read: p.read, update: p.update, delete: p.delete },
          create: { staffRoleId: id, moduleId: p.moduleId, create: p.create, read: p.read, update: p.update, delete: p.delete },
        }),
      ),
    );

    return this.detail(id);
  }

  async assignUsers(id: string, data: AssignUsersDto) {
    const role = await this.prisma.staffRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException({ error: 'Role not found.' });

    await this.prisma.user.updateMany({
      where: { id: { in: data.userIds } },
      data: { staffRoleId: id },
    });

    return { ok: true };
  }

  async remove(id: string) {
    const role = await this.prisma.staffRole.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException({ error: 'Role not found.' });
    if (role._count.users > 0) {
      throw new ConflictException({ error: 'Cannot delete a role that is assigned to users.' });
    }

    await this.prisma.staffRole.delete({ where: { id } });
    return { ok: true };
  }
}
