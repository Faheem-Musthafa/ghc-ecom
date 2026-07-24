import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Session } from '@supabase/supabase-js';
import { CookieOptions, Request, Response } from 'express';

export const COOKIE_NAMES = {
  access: ['__Host-ghc_access', 'ghc_access'],
  refresh: ['__Host-ghc_refresh', 'ghc_refresh'],
  csrf: ['__Host-ghc_csrf', 'ghc_csrf'],
} as const;

type ParsedCookieRequest = Request & { cookies?: Record<string, string> };

function firstCookie(request: Request, names: readonly string[]): string | undefined {
  const cookies = (request as ParsedCookieRequest).cookies;
  if (!cookies) return undefined;
  return names.map((name) => cookies[name]).find((value) => typeof value === 'string' && value);
}

export function readAccessToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token) return token;
  }
  return firstCookie(request, COOKIE_NAMES.access);
}

export function authorizationValue(request: Request): string | undefined {
  const token = readAccessToken(request);
  return token ? `Bearer ${token}` : undefined;
}

@Injectable()
export class SessionCookieService {
  private readonly production: boolean;
  private readonly refreshMaxAgeMs: number;

  constructor(private readonly config: ConfigService) {
    this.production = config.getOrThrow<string>('NODE_ENV') === 'production';
    this.refreshMaxAgeMs = config.getOrThrow<number>('SESSION_REFRESH_TTL_SECONDS') * 1_000;
  }

  get accessCookieName(): string {
    return this.production ? COOKIE_NAMES.access[0] : COOKIE_NAMES.access[1];
  }

  get refreshCookieName(): string {
    return this.production ? COOKIE_NAMES.refresh[0] : COOKIE_NAMES.refresh[1];
  }

  get csrfCookieName(): string {
    return this.production ? COOKIE_NAMES.csrf[0] : COOKIE_NAMES.csrf[1];
  }

  get secure(): boolean {
    return this.production;
  }

  get refreshTtlMs(): number {
    return this.refreshMaxAgeMs;
  }

  readAccessToken(request: Request): string | undefined {
    return readAccessToken(request);
  }

  readRefreshToken(request: Request): string | undefined {
    return firstCookie(request, COOKIE_NAMES.refresh);
  }

  hasBrowserSession(request: Request): boolean {
    return Boolean(
      firstCookie(request, COOKIE_NAMES.access) || firstCookie(request, COOKIE_NAMES.refresh),
    );
  }

  authorizationValue(request: Request): string | undefined {
    return authorizationValue(request);
  }

  setSession(response: Response, session: Session): void {
    const accessLifetimeSeconds = session.expires_at
      ? Math.max(60, session.expires_at - Math.floor(Date.now() / 1_000))
      : 3_600;
    response.cookie(this.accessCookieName, session.access_token, {
      ...this.baseCookieOptions(),
      maxAge: accessLifetimeSeconds * 1_000,
    });
    response.cookie(this.refreshCookieName, session.refresh_token, {
      ...this.baseCookieOptions(),
      maxAge: this.refreshMaxAgeMs,
    });
  }

  clear(response: Response): void {
    for (const name of [...COOKIE_NAMES.access, ...COOKIE_NAMES.refresh, ...COOKIE_NAMES.csrf]) {
      response.clearCookie(name, this.baseCookieOptions());
    }
  }

  noStore(response: Response): void {
    response.setHeader('cache-control', 'private, no-store');
    response.setHeader('pragma', 'no-cache');
    response.setHeader('expires', '0');
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/',
    };
  }
}
