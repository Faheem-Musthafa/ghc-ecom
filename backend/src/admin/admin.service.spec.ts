import { AppRole } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('records actor, action, target, and role for an admin role assignment', async () => {
    const assignment = {
      userId: 'target-id',
      role: AppRole.SUPPORT_AGENT,
      assignedBy: 'admin-id',
      assignedAt: new Date(),
    };
    const prisma = {
      userRole: {
        upsert: jest.fn().mockResolvedValue(assignment),
      },
    };
    const audit = {
      record: jest.fn().mockResolvedValue({ id: 'audit-id' }),
    };
    const supabase = {
      createAdminUser: jest.fn(),
      deleteAdminUser: jest.fn(),
      listAdminUsers: jest.fn(),
    };
    const service = new AdminService(prisma as never, audit as never, supabase as never);

    await expect(
      service.assignRole('admin-id', 'target-id', AppRole.SUPPORT_AGENT, {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    ).resolves.toEqual(assignment);

    expect(audit.record).toHaveBeenCalledWith({
      actorId: 'admin-id',
      action: 'user.role.assigned',
      entityType: 'user',
      entityId: 'target-id',
      metadata: { role: AppRole.SUPPORT_AGENT },
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });

  it('creates a confirmed staff account with a generated password and selected role', async () => {
    const user = {
      id: 'staff-id',
      email: 'staff@example.com',
      user_metadata: { full_name: 'Store Staff' },
      created_at: '2026-08-06T00:00:00.000Z',
    };
    const prisma = {
      userRole: {
        upsert: jest.fn().mockResolvedValue({ userId: user.id, role: AppRole.WAREHOUSE_MANAGER }),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-id' }) };
    const supabase = {
      createAdminUser: jest.fn().mockResolvedValue(user),
      deleteAdminUser: jest.fn(),
      listAdminUsers: jest.fn(),
    };
    const service = new AdminService(prisma as never, audit as never, supabase as never);

    const result = await service.createStaffUser(
      'admin-id',
      { email: 'STAFF@EXAMPLE.COM', fullName: 'Store Staff', role: AppRole.WAREHOUSE_MANAGER },
      { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    );

    expect(supabase.createAdminUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'staff@example.com',
      fullName: 'Store Staff',
      password: expect.stringMatching(/^[A-Za-z0-9_-]{24}$/),
    }));
    expect(result).toEqual(expect.objectContaining({
      user: expect.objectContaining({ email: 'staff@example.com', roles: [AppRole.WAREHOUSE_MANAGER] }),
      temporaryPassword: expect.stringMatching(/^[A-Za-z0-9_-]{24}$/),
    }));
  });
});
