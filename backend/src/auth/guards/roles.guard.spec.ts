import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

const context = {
  getHandler: jest.fn(),
  getClass: jest.fn(),
  switchToHttp: () => ({
    getRequest: (): { user: { id: string } } => ({ user: { id: 'customer-id' } }),
  }),
} as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('rejects a user without a required admin role', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([AppRole.ADMIN]),
    };
    const prisma = {
      userRole: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const guard = new RolesGuard(reflector as never, prisma as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userRole.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'customer-id',
        role: { in: [AppRole.ADMIN] },
      },
    });
  });

  it('allows a user with a required role', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([AppRole.ADMIN]),
    };
    const prisma = {
      userRole: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 'admin-id',
          role: AppRole.ADMIN,
        }),
      },
    };
    const adminContext = {
      ...context,
      switchToHttp: () => ({
        getRequest: (): { user: { id: string } } => ({ user: { id: 'admin-id' } }),
      }),
    } as ExecutionContext;
    const guard = new RolesGuard(reflector as never, prisma as never);

    await expect(guard.canActivate(adminContext)).resolves.toBe(true);
  });
});
