import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Session, User } from '@supabase/supabase-js';
import { AppRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RegisterDto } from './dto/register.dto';

export interface AuthResult {
  user: User | null;
  session: Session | null;
}

export const rolesCacheKey = (userId: string): string => `auth:roles:${userId}`;
const ROLES_CACHE_TTL_SECONDS = 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis?: RedisService,
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
      throw new UnauthorizedException('Invalid email or password');
    }
    return data;
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.refresh(refreshToken);
    if (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return data;
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
