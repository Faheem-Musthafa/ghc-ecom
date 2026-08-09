import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfService } from './csrf.service';
import { RolesGuard } from './guards/roles.guard';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { SessionCookieService } from './session-cookie.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionCookieService, CsrfService, SupabaseAuthGuard, RolesGuard],
  exports: [AuthService, SessionCookieService, SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
