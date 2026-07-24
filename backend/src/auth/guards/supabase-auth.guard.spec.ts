import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

function createContext(authorization?: string): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = {
    headers: authorization ? { authorization } : {},
  };
  const context = {
    switchToHttp: () => ({
      getRequest: (): Record<string, unknown> => request,
    }),
  } as ExecutionContext;
  return { context, request };
}

describe('SupabaseAuthGuard', () => {
  it('rejects unauthenticated requests', async () => {
    const guard = new SupabaseAuthGuard(
      { verifyAccessToken: jest.fn() } as never,
      { readAccessToken: jest.fn() } as never,
    );
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifies the bearer token and attaches the user', async () => {
    const supabase = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'customer@example.com',
      }),
    };
    const cookies = { readAccessToken: jest.fn().mockReturnValue('valid-token') };
    const guard = new SupabaseAuthGuard(supabase as never, cookies as never);
    const { context, request } = createContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(supabase.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(cookies.readAccessToken).toHaveBeenCalled();
    expect(request.user).toEqual({
      id: 'user-id',
      email: 'customer@example.com',
    });
  });
});
