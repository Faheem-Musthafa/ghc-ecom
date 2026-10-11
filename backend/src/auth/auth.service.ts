import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Session, User } from '@supabase/supabase-js';
import { AppRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { isTransientAuthError, SupabaseService } from '../supabase/supabase.service';
import { RegisterDto } from './dto/register.dto';

export interface AuthResult {
  user: User | null;
  session: Session | null;
}

export const rolesCacheKey = (userId: string): string => `auth:roles:${userId}`;
const ROLES_CACHE_TTL_SECONDS = 60;

export interface SignInContext {
  ipAddress?: string;
  userAgent?: string;
}

const unavailable = (): ServiceUnavailableException =>
  new ServiceUnavailableException('Sign-in service is temporarily unavailable. Please retry.');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis?: RedisService,
    private readonly audit?: AuditService,
  ) {}

  async register(input: RegisterDto): Promise<AuthResult> {
    const emailRedirectTo = `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/auth`;
    const { data, error } = await this.supabase.register(input, emailRedirectTo);
    if (error) {
      throw new BadRequestException('Registration could not be completed');
    }
    return data;
  }

  async roles(userId: string): Promise<AppRole[]> {
    try {
      const cached = await this.redis?.getJson<AppRole[]>(rolesCacheKey(userId));
      if (cached) return cached;
    } catch {
      // Role authorization falls back to PostgreSQL if Redis is unavailable.
    }
    const rows = await this.prisma.userRole.findMany({ where: { userId }, select: { role: true } });
    const roles = rows.map((row) => row.role);
    try {
      await this.redis?.setJson(rolesCacheKey(userId), roles, ROLES_CACHE_TTL_SECONDS);
    } catch {
      // Role authorization remains correct without caching.
    }
    return roles;
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.login(email, password);
    if (error) {
      if (isTransientAuthError(error)) throw unavailable();
      throw new UnauthorizedException('Invalid email or password');
    }
    return data;
  }

  /**
   * Throws UnauthorizedException only when Supabase rejects the refresh token. Outages, timeouts
   * and rate limits become 503 so the browser keeps its session and retries.
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.refresh(refreshToken);
    if (error) {
      if (isTransientAuthError(error)) throw unavailable();
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return data;
  }

  /** Records a successful staff sign-in in the audit log. Customer sign-ins are not recorded. */
  async recordSignIn(
    user: { id: string; email: string | null },
    roles: AppRole[],
    context: SignInContext,
  ): Promise<void> {
    const staffRoles = roles.filter((role) => role !== AppRole.CUSTOMER);
    if (!staffRoles.length || !this.audit) return;
    try {
      await this.audit.record({
        actorId: user.id,
        action: 'auth.staff.signed_in',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          ...(user.email ? { entityLabel: user.email, email: user.email } : {}),
          roles: staffRoles,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    } catch (error) {
      // Signing in must not fail because the audit write did.
      this.logger.error(
        `Staff sign-in audit failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  verifyAccessToken(accessToken: string): Promise<User> {
    return this.supabase.verifyAccessToken(accessToken);
  }

  logout(accessToken: string): Promise<void> {
    return this.supabase.logout(accessToken);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo = `${this.config.getOrThrow<string>('FRONTEND_ORIGIN')}/auth/reset-password`;
    await this.supabase.requestPasswordReset(email, redirectTo);
  }

  async resetPassword(
    recoveryAccessToken: string,
    recoveryRefreshToken: string,
    password: string,
  ): Promise<void> {
    try {
      await this.supabase.resetPassword(recoveryAccessToken, recoveryRefreshToken, password);
    } catch {
      throw new UnauthorizedException('Password recovery link is invalid or expired');
    }
  }
}
