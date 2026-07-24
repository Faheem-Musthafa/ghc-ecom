import { Injectable } from '@nestjs/common';
import { AppRole, AuditLog, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async assignRole(
    actorId: string,
    userId: string,
    role: AppRole,
    context: RequestContext,
  ): Promise<UserRole> {
    const assignment = await this.prisma.userRole.upsert({
      where: {
        userId_role: { userId, role },
      },
      create: {
        userId,
        role,
        assignedBy: actorId,
      },
      update: {
        assignedBy: actorId,
        assignedAt: new Date(),
      },
    });

    await this.audit.record({
      actorId,
      action: 'user.role.assigned',
      entityType: 'user',
      entityId: userId,
      metadata: { role },
      ...context,
    });
    return assignment;
  }

  listAuditLogs(): Promise<AuditLog[]> {
    return this.audit.list();
  }
}
