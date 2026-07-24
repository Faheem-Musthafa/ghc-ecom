import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedRequest } from '../authenticated-user';
import { SessionCookieService } from '../session-cookie.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cookies: SessionCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = this.cookies.readAccessToken(request);
    if (!accessToken) {
      throw new UnauthorizedException('Authentication is required');
    }

    const user = await this.supabase.verifyAccessToken(accessToken);
    request.user = {
      id: user.id,
      email: user.email ?? null,
      ...(typeof user.user_metadata?.full_name === 'string'
        ? { user_metadata: { full_name: user.user_metadata.full_name } }
        : {}),
    };
    return true;
  }
}
