import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { AppRole, AuditLog, UserRole } from '@prisma/client';
import { User } from '@supabase/supabase-js';
import { AuditLogQuery, AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  isEmailTakenError,
  isTransientAuthError,
  SupabaseService,
} from '../supabase/supabase.service';
import { rolesCacheKey } from '../auth/auth.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { GrantStaffAccessDto } from './dto/grant-staff-access.dto';

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

export interface AuditLogView extends AuditLog {
  actorLabel: string | null;
}

export interface AuditLogPageView {
  items: AuditLogView[];
  nextCursor: string | null;
}

interface DirectoryEntry {
  user: User | null;
  expiresAt: number;
}

/** Staff and audit actors are looked up one account at a time; keep them briefly to spare Supabase. */
const DIRECTORY_TTL_MS = 60_000;
const DIRECTORY_MAX_ENTRIES = 2_000;
const DIRECTORY_CONCURRENCY = 5;

const fullNameOf = (user: User): string | null => {
  const fullName: unknown = user.user_metadata?.full_name;
  return typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null;
};

const toStaffUser = (user: User, roles: AppRole[]): StaffUser => ({
  id: user.id,
  email: user.email || '',
  fullName: fullNameOf(user),
  roles,
  createdAt: user.created_at,
});

@Injectable()
export class AdminService {
  private readonly directory = new Map<string, DirectoryEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseService,
    private readonly redis?: RedisService,
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
    let user: User;
    try {
      user = await this.supabase.createAdminUser({
        email,
        password: temporaryPassword,
        fullName: input.fullName?.trim() || email,
      });
    } catch (error) {
      if (isEmailTakenError(error)) {
        throw new ConflictException(
          'An account already uses this email. Choose "Existing account" to give it staff access instead.',
        );
      }
      if (isTransientAuthError(error)) {
        throw new ServiceUnavailableException(
          'The account service is temporarily unavailable. Please retry.',
        );
      }
      throw error;
    }
    try {
      // The auth.users trigger gives every new account the customer role; staff
      // accounts are for the admin workspace only, not the storefront.
      await this.prisma.userRole.deleteMany({ where: { userId: user.id, role: AppRole.CUSTOMER } });
      await this.assignRole(actorId, user.id, input.role, context, user.email || email);
      return {
        user: { ...toStaffUser(user, [input.role]), email: user.email || email },
        temporaryPassword,
      };
    } catch (error) {
      try {
        await this.supabase.deleteAdminUser(user.id);
      } catch {
        // The original failure is more actionable; cleanup is best-effort.
      }
      throw error;
    }
  }

  /** Gives staff access to an account that already exists, e.g. a customer who joined the team. */
  async grantStaffAccess(
    actorId: string,
    input: GrantStaffAccessDto,
    context: RequestContext,
  ): Promise<StaffUser> {
    if (input.role === AppRole.CUSTOMER) {
      throw new BadRequestException('Staff accounts must use an administrative role');
    }
    const email = input.email.trim().toLowerCase();
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new NotFoundException(
        'No account uses this email. Choose "New account" to create one instead.',
      );
    }
    await this.assignRole(actorId, user.id, input.role, context, user.email || email);
    // Staff accounts are for the admin workspace only (see migration staff_without_customer_role).
    await this.prisma.userRole.deleteMany({ where: { userId: user.id, role: AppRole.CUSTOMER } });
    await this.forgetCachedRoles(user.id);
    const roles = await this.prisma.userRole.findMany({
      where: { userId: user.id, role: { not: AppRole.CUSTOMER } },
      orderBy: { assignedAt: 'asc' },
    });
    return toStaffUser(
      user,
      roles.map((assignment) => assignment.role),
    );
  }

  /** Lists accounts holding a staff role, starting from the role table rather than every account. */
  async listStaffUsers(): Promise<StaffUser[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { role: { not: AppRole.CUSTOMER } },
      orderBy: { assignedAt: 'asc' },
    });
    const rolesByUser = new Map<string, AppRole[]>();
    for (const assignment of assignments) {
      rolesByUser.set(assignment.userId, [
        ...(rolesByUser.get(assignment.userId) || []),
        assignment.role,
      ]);
    }
    const users = await this.lookupUsers([...rolesByUser.keys()]);
    return [...rolesByUser.entries()]
      .flatMap(([userId, roles]) => {
        const user = users.get(userId);
        return user ? [toStaffUser(user, roles)] : [];
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async assignRole(
    actorId: string,
    userId: string,
    role: AppRole,
    context: RequestContext,
    targetEmail?: string,
  ): Promise<UserRole> {
    if (role === AppRole.CUSTOMER) {
      throw new BadRequestException('Customer access cannot be managed from the staff workspace');
    }
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
      metadata: await this.roleChangeMetadata(userId, role, targetEmail),
      ...context,
    });
    await this.forgetCachedRoles(userId);
    return assignment;
  }

  async removeRole(
    actorId: string,
    userId: string,
    role: AppRole,
    context: RequestContext,
  ): Promise<void> {
    if (role === AppRole.CUSTOMER) {
      throw new BadRequestException('Customer access cannot be managed from the staff workspace');
    }
    if (role === AppRole.ADMIN) {
      if (actorId === userId) {
        throw new BadRequestException('You cannot remove your own administrator access');
      }
    }

    const result =
      role === AppRole.ADMIN
        ? await this.prisma.$transaction(async (transaction) => {
            await transaction.$executeRaw`select pg_advisory_xact_lock(
              hashtextextended('staff-admin-role-invariant', 0)
            )`;
            const administratorCount = await transaction.userRole.count({
              where: { role: AppRole.ADMIN },
            });
            if (administratorCount <= 1) {
              throw new BadRequestException('The final administrator cannot be removed');
            }
            return transaction.userRole.deleteMany({ where: { userId, role } });
          })
        : await this.prisma.userRole.deleteMany({ where: { userId, role } });
    if (!result.count) return;

    await this.audit.record({
      actorId,
      action: 'user.role.removed',
      entityType: 'user',
      entityId: userId,
      metadata: await this.roleChangeMetadata(userId, role),
      ...context,
    });
    await this.forgetCachedRoles(userId);
  }

  async listAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogPageView> {
    const page = await this.audit.list(query);
    let actors = new Map<string, User | null>();
    try {
      actors = await this.lookupUsers(
        page.items.flatMap((log) => (log.actorId ? [log.actorId] : [])),
      );
    } catch {
      // Names are a convenience; the actor id is still shown.
    }
    return {
      nextCursor: page.nextCursor,
      items: page.items.map((log) => {
        if (!log.actorId) return { ...log, actorLabel: 'System' };
        const actor = actors.get(log.actorId);
        if (!actor) return { ...log, actorLabel: null };
        const fullName = fullNameOf(actor);
        const label = fullName
          ? `${fullName}${actor.email ? ` · ${actor.email}` : ''}`
          : actor.email || actor.id;
        return { ...log, actorLabel: label };
      }),
    };
  }

  private async roleChangeMetadata(
    userId: string,
    role: AppRole,
    knownEmail?: string,
  ): Promise<{ role: AppRole; entityLabel?: string; email?: string }> {
    let email = knownEmail;
    if (!email) {
      try {
        email = (await this.lookupUsers([userId])).get(userId)?.email || undefined;
      } catch {
        // The audit row still carries the user id.
      }
    }
    return email ? { role, entityLabel: email, email } : { role };
  }

  private async forgetCachedRoles(userId: string): Promise<void> {
    try {
      await this.redis?.delete(rolesCacheKey(userId));
    } catch {
      // The short TTL bounds stale role cache entries if Redis is unavailable.
    }
  }

  /** Fetches accounts by id with bounded concurrency, reusing lookups from the last minute. */
  private async lookupUsers(userIds: string[]): Promise<Map<string, User | null>> {
    const now = Date.now();
    const found = new Map<string, User | null>();
    const missing: string[] = [];
    for (const userId of new Set(userIds)) {
      const cached = this.directory.get(userId);
      if (cached && cached.expiresAt > now) found.set(userId, cached.user);
      else missing.push(userId);
    }
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < missing.length) {
        const userId = missing[next++];
        const user = await this.supabase.getAdminUserById(userId);
        found.set(userId, user);
        if (this.directory.size >= DIRECTORY_MAX_ENTRIES) this.directory.clear();
        this.directory.set(userId, { user, expiresAt: Date.now() + DIRECTORY_TTL_MS });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(DIRECTORY_CONCURRENCY, missing.length) }, worker),
    );
    return found;
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    let userId: string | null | undefined;
    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        select id from auth.users where lower(email) = ${email} order by created_at limit 1
      `;
      userId = rows[0]?.id ?? null;
    } catch {
      // The database role cannot read auth.users; fall back to the Auth admin API.
      userId = undefined;
    }
    if (userId === undefined) return this.supabase.findAdminUserByEmail(email);
    if (userId === null) return null;
    this.directory.delete(userId);
    return (await this.lookupUsers([userId])).get(userId) ?? null;
  }
}
