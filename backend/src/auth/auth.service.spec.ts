import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const authData = {
    user: { id: 'user-id', email: 'customer@example.com' },
    session: { access_token: 'access-token', refresh_token: 'refresh-token' },
  };
  const supabase = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
  };
  const service = new AuthService(supabase as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers, logs in, refreshes, logs out, and requests password reset', async () => {
    supabase.register.mockResolvedValue({ data: authData, error: null });
    supabase.login.mockResolvedValue({ data: authData, error: null });
    supabase.refresh.mockResolvedValue({ data: authData, error: null });
    supabase.logout.mockResolvedValue(undefined);
    supabase.requestPasswordReset.mockResolvedValue(undefined);
    supabase.resetPassword.mockResolvedValue(undefined);

    await expect(
      service.register({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Customer',
      }),
    ).resolves.toEqual(authData);
    await expect(service.login('customer@example.com', 'password123')).resolves.toEqual(authData);
    await expect(service.refresh('refresh-token')).resolves.toEqual(authData);
    await expect(service.logout('access-token')).resolves.toBeUndefined();
    await expect(service.requestPasswordReset('customer@example.com')).resolves.toBeUndefined();
    await expect(
      service.resetPassword('recovery-access-token', 'recovery-refresh-token', 'long-new-password'),
    ).resolves.toBeUndefined();

    expect(supabase.requestPasswordReset).toHaveBeenCalledWith(
      'customer@example.com',
      'http://localhost:3000/auth/reset-password',
    );
    expect(supabase.resetPassword).toHaveBeenCalledWith(
      'recovery-access-token',
      'recovery-refresh-token',
      'long-new-password',
    );
  });

  it('does not expose the provider login error', async () => {
    supabase.login.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('provider detail'),
    });

    await expect(service.login('customer@example.com', 'incorrect')).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
  });

  it('returns a safe registration error', async () => {
    supabase.register.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Email is already registered'),
    });

    await expect(
      service.register({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Customer',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
