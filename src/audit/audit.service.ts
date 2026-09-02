import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: { userId?: number | null; action: string; detail?: string; ipAddress?: string | null }) {
    await this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        detail: params.detail,
        ipAddress: params.ipAddress,
      },
    });
  }
}
