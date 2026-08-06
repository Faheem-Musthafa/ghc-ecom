import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppRole, AuditLog, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface StaffUser {
  id: string;
  email: string;
  fullName: string | null;
  roles: AppRole[];
  createdAt: string;
}

export interface CreatedStaffUser {
  user: StaffUser;
  temporaryPassword: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseService,
  ) {}

  async createStaffUser(
    actorId: string,
    input: CreateStaffUserDto,
    context: RequestContext,
  ): Promise<CreatedStaffUser> {
    if (input.role === AppRole.CUSTOMER) {
      throw new BadRequestException('Staff accounts must use an administrative role');
    }
    const temporaryPassword = randomBytes(18).toString('base64url');
    const email = input.email.trim().toLowerCase();
    let userId: string | null = null;
    try {
      const user = await this.supabase.createAdminUser({
        email,
        password: temporaryPassword,
        fullName: input.fullName?.trim() || email,
      });
      userId = user.id;
      await this.assignRole(actorId, user.id, input.role, context);
      return {
        user: {
          id: user.id,
          email: user.email || email,
          fullName: typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : null,
          roles: [input.role],
          createdAt: user.created_at,
        },
        temporaryPassword,
      };
    } catch (error) {
      if (userId) {
        try {
          await this.supabase.deleteAdminUser(userId);
        } catch {
          // The original failure is more actionable; cleanup is best-effort.
        }
      }
      throw error;
    }
  }

  async listStaffUsers(): Promise<StaffUser[]> {
    const users = await this.supabase.listAdminUsers();
    const roles = await this.prisma.userRole.findMany({
      where: {
        userId: { in: users.map((user) => user.id) },
        role: { not: AppRole.CUSTOMER },
      },
      orderBy: { assignedAt: 'desc' },
    });
    const rolesByUser = new Map<string, AppRole[]>();
    for (const assignment of roles) {
      rolesByUser.set(assignment.userId, [...(rolesByUser.get(assignment.userId) || []), assignment.role]);
    }
    return users
      .filter((user) => rolesByUser.has(user.id))
      .map((user) => ({
        id: user.id,
        email: user.email || '',
        fullName: typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : null,
        roles: rolesByUser.get(user.id) || [],
        createdAt: user.created_at,
      }));
  }

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
