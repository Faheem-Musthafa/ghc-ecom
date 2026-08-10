import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthResponse,
  AuthTokenResponsePassword,
  createClient,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

@Injectable()
export class SupabaseService {
  private readonly publicClient: SupabaseClient;
  private readonly adminClient: SupabaseClient;
  private readonly url: string;
  private readonly anonKey: string;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('SUPABASE_URL');
    this.anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
    const clientOptions = {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    };

    this.publicClient = createClient(this.url, this.anonKey, clientOptions);
    this.adminClient = createClient(
      this.url,
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      clientOptions,
    );
  }

  register(input: RegisterInput, emailRedirectTo: string): Promise<AuthResponse> {
    return this.publicClient.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo,
        data: {
          full_name: input.fullName,
        },
      },
    });
  }

  login(email: string, password: string): Promise<AuthTokenResponsePassword> {
    return this.publicClient.auth.signInWithPassword({ email, password });
  }

  refresh(refreshToken: string): Promise<AuthResponse> {
    return this.publicClient.auth.refreshSession({ refresh_token: refreshToken });
  }

  async logout(accessToken: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.signOut(accessToken, 'local');
    if (error) {
      throw error;
    }
  }

  async createAdminUser(input: RegisterInput): Promise<User> {
    const { data, error } = await this.adminClient.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
      },
    });
    if (error || !data.user) throw error || new Error('Supabase did not create the user');
    return data.user;
  }

  async deleteAdminUser(userId: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(userId);
    if (error) throw error;
  }

  async listAdminUsers(): Promise<User[]> {
    const { data, error } = await this.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    return data.users;
  }

  async resetPassword(accessToken: string, refreshToken: string, password: string): Promise<void> {
    const recoveryClient = createClient(this.url, this.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { error: sessionError } = await recoveryClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) {
      throw sessionError;
    }
    const { error } = await recoveryClient.auth.updateUser({
      password,
    });
    if (error) {
      throw error;
    }
    const { error: signOutError } = await recoveryClient.auth.signOut({
      scope: 'global',
    });
    if (signOutError) {
      throw signOutError;
    }
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.publicClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      throw error;
    }
  }

  async verifyAccessToken(accessToken: string): Promise<User> {
    const { data, error } = await this.publicClient.auth.getClaims(accessToken);
    const claims = data?.claims;
    if (error || !claims?.sub) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return {
      id: claims.sub,
      aud: Array.isArray(claims.aud) ? claims.aud[0] ?? 'authenticated' : claims.aud,
      role: claims.role,
      email: claims.email,
      phone: claims.phone,
      app_metadata: claims.app_metadata ?? {},
      user_metadata: claims.user_metadata ?? {},
      is_anonymous: claims.is_anonymous,
      created_at: new Date(claims.iat * 1000).toISOString(),
    };
  }

  async uploadProductImage(path: string, body: Buffer): Promise<void> {
    const { error } = await this.adminClient.storage.from('product-images').upload(path, body, {
      cacheControl: '31536000',
      contentType: 'image/webp',
      upsert: false,
    });
    if (error) {
      throw error;
    }
  }

  async removeProductImages(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    const { error } = await this.adminClient.storage.from('product-images').remove(paths);
    if (error) {
      throw error;
    }
  }

  getProductImagePublicUrl(path: string): string {
    return this.adminClient.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }

  async uploadProductVideo(path: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.adminClient.storage.from('product-videos').upload(path, body, {
      cacheControl: '31536000',
      contentType,
      upsert: false,
    });
    if (error) {
      throw error;
    }
  }

  async removeProductVideos(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    const { error } = await this.adminClient.storage.from('product-videos').remove(paths);
    if (error) {
      throw error;
    }
  }

  getProductVideoPublicUrl(path: string): string {
    return this.adminClient.storage.from('product-videos').getPublicUrl(path).data.publicUrl;
  }

  async uploadPrivateDocument(path: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.adminClient.storage.from('private-documents').upload(path, body, {
      cacheControl: '3600',
      contentType,
      upsert: false,
    });
    if (error) {
      throw error;
    }
  }

  async createPrivateDocumentUrl(path: string, expiresInSeconds = 300): Promise<string> {
    const { data, error } = await this.adminClient.storage
      .from('private-documents')
      .createSignedUrl(path, expiresInSeconds);
    if (error) {
      throw error;
    }
    return data.signedUrl;
  }

  async removePrivateDocuments(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      return;
    }
    const { error } = await this.adminClient.storage.from('private-documents').remove(paths);
    if (error) {
      throw error;
    }
  }
}
