import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AuditEvent {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(event: AuditEvent): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        metadata: event.metadata ?? {},
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
    });
  }

  list(limit = 100): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }
}
