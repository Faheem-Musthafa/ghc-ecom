import { ConflictException, NotFoundException } from '@nestjs/common';
import { AppRole } from '@prisma/client';
import { AuthApiError } from '@supabase/supabase-js';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('adds a human actor label to audit log records', async () => {
    const auditLog = {
      id: 'audit-id',
      actorId: 'admin-id',
      action: 'catalogue.product.updated',
      entityType: 'product',
      entityId: 'product-id',
      metadata: {},
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    };
    const audit = {
      list: jest.fn().mockResolvedValue({
        items: [
          auditLog,
          { ...auditLog, id: 'audit-2' },
          { ...auditLog, id: 'audit-3', actorId: null },
        ],
        nextCursor: 'audit-3',
      }),
    };
    const supabase = {
      getAdminUserById: jest.fn().mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        user_metadata: { full_name: 'Faheem' },
      }),
    };
    const service = new AdminService({} as never, audit as never, supabase as never);

    await expect(service.listAuditLogs({ limit: 3, entityType: 'product' })).resolves.toEqual({
      nextCursor: 'audit-3',
      items: [
        expect.objectContaining({ actorLabel: 'Faheem · admin@example.com' }),
        expect.objectContaining({ actorLabel: 'Faheem · admin@example.com' }),
        expect.objectContaining({ actorLabel: 'System' }),
      ],
    });
    expect(audit.list).toHaveBeenCalledWith({ limit: 3, entityType: 'product' });
    // Only the distinct actor is looked up, never the whole account list.
    expect(supabase.getAdminUserById).toHaveBeenCalledTimes(1);
  });

  it('lists staff from role assignments and looks up only those accounts', async () => {
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'staff-a', role: AppRole.SUPPORT_AGENT },
          { userId: 'staff-b', role: AppRole.ADMIN },
          { userId: 'staff-a', role: AppRole.CATALOGUE_MANAGER },
          { userId: 'deleted', role: AppRole.WAREHOUSE_MANAGER },
        ]),
      },
    };
    const accounts: Record<string, unknown> = {
      'staff-a': {
        id: 'staff-a',
        email: 'a@example.com',
        user_metadata: { full_name: 'Asha' },
        created_at: '2026-01-01T00:00:00.000Z',
      },
      'staff-b': {
        id: 'staff-b',
        email: 'b@example.com',
        user_metadata: {},
        created_at: '2026-02-01T00:00:00.000Z',
      },
    };
    const supabase = {
      getAdminUserById: jest.fn(async (id: string) => accounts[id] ?? null),
    };
    const service = new AdminService(prisma as never, {} as never, supabase as never);

    await expect(service.listStaffUsers()).resolves.toEqual([
      expect.objectContaining({ id: 'staff-b', fullName: null, roles: [AppRole.ADMIN] }),
      expect.objectContaining({
        id: 'staff-a',
        fullName: 'Asha',
        roles: [AppRole.SUPPORT_AGENT, AppRole.CATALOGUE_MANAGER],
      }),
    ]);
    expect(prisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: { not: AppRole.CUSTOMER } } }),
    );
    expect(supabase.getAdminUserById).toHaveBeenCalledTimes(3);

    await service.listStaffUsers();
    expect(supabase.getAdminUserById).toHaveBeenCalledTimes(3);
  });

  it('answers 409 when a new staff email already has an account', async () => {
    const supabase = {
      createAdminUser: jest
        .fn()
        .mockRejectedValue(
          new AuthApiError(
            'A user with this email address has already been registered',
            422,
            'email_exists',
          ),
        ),
      deleteAdminUser: jest.fn(),
    };
    const service = new AdminService({} as never, {} as never, supabase as never);

    await expect(
      service.createStaffUser(
        'admin-id',
        { email: 'taken@example.com', role: AppRole.SUPPORT_AGENT },
        {},
      ),
    ).rejects.toThrow(ConflictException);
    expect(supabase.deleteAdminUser).not.toHaveBeenCalled();
  });

  it('grants staff access to an existing account found by email', async () => {
    const user = {
      id: 'existing-id',
      email: 'existing@example.com',
      user_metadata: { full_name: 'Existing Person' },
      created_at: '2026-03-01T00:00:00.000Z',
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'existing-id' }]),
      userRole: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ role: AppRole.WAREHOUSE_MANAGER }]),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const supabase = {
      getAdminUserById: jest.fn().mockResolvedValue(user),
      findAdminUserByEmail: jest.fn(),
    };
    const service = new AdminService(prisma as never, audit as never, supabase as never);

    await expect(
      service.grantStaffAccess(
        'admin-id',
        { email: ' Existing@Example.com ', role: AppRole.WAREHOUSE_MANAGER },
        {},
      ),
    ).resolves.toEqual(
      expect.objectContaining({ id: 'existing-id', roles: [AppRole.WAREHOUSE_MANAGER] }),
    );
    expect(supabase.findAdminUserByEmail).not.toHaveBeenCalled();
    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'existing-id', role: AppRole.CUSTOMER },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.role.assigned',
        metadata: {
          role: AppRole.WAREHOUSE_MANAGER,
          entityLabel: 'existing@example.com',
          email: 'existing@example.com',
        },
      }),
    );
  });

  it('falls back to the Auth API email search and reports a missing account', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('permission denied')) };
    const supabase = { findAdminUserByEmail: jest.fn().mockResolvedValue(null) };
    const service = new AdminService(prisma as never, {} as never, supabase as never);

    await expect(
      service.grantStaffAccess(
        'admin-id',
        { email: 'nobody@example.com', role: AppRole.ADMIN },
        {},
      ),
    ).rejects.toThrow(NotFoundException);
    expect(supabase.findAdminUserByEmail).toHaveBeenCalledWith('nobody@example.com');
  });

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
      getAdminUserById: jest
        .fn()
        .mockResolvedValue({ id: 'target-id', email: 'target@example.com' }),
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
      metadata: {
        role: AppRole.SUPPORT_AGENT,
        entityLabel: 'target@example.com',
        email: 'target@example.com',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });

  it('removes staff access, records the change, and clears the cached roles', async () => {
    const prisma = {
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-id' }) };
    const redis = { delete: jest.fn().mockResolvedValue(1) };
    const supabase = { getAdminUserById: jest.fn().mockRejectedValue(new Error('offline')) };
    const service = new AdminService(
      prisma as never,
      audit as never,
      supabase as never,
      redis as never,
    );

    await service.removeRole('admin-id', 'staff-id', AppRole.SUPPORT_AGENT, {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });

    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'staff-id', role: AppRole.SUPPORT_AGENT },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-id',
        action: 'user.role.removed',
        entityId: 'staff-id',
        metadata: { role: AppRole.SUPPORT_AGENT },
      }),
    );
    expect(redis.delete).toHaveBeenCalledWith('auth:roles:staff-id');
  });

  it('does not let an administrator remove their own administrator access', async () => {
    const prisma = { userRole: { count: jest.fn(), deleteMany: jest.fn() } };
    const service = new AdminService(prisma as never, {} as never, {} as never);

    await expect(service.removeRole('admin-id', 'admin-id', AppRole.ADMIN, {})).rejects.toThrow(
      'You cannot remove your own administrator access',
    );
    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('protects the final administrator from removal', async () => {
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      userRole: {
        count: jest.fn().mockResolvedValue(1),
        deleteMany: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const service = new AdminService(prisma as never, {} as never, {} as never);

    await expect(
      service.removeRole('admin-id', 'other-admin-id', AppRole.ADMIN, {}),
    ).rejects.toThrow('The final administrator cannot be removed');
    expect(transaction.$executeRaw).toHaveBeenCalled();
    expect(transaction.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('serializes the administrator invariant check with the removal', async () => {
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      userRole: {
        count: jest.fn().mockResolvedValue(2),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(transaction)) };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-id' }) };
    const supabase = { getAdminUserById: jest.fn().mockResolvedValue(null) };
    const service = new AdminService(prisma as never, audit as never, supabase as never);

    await service.removeRole('admin-id', 'other-admin-id', AppRole.ADMIN, {});

    expect(transaction.$executeRaw).toHaveBeenCalled();
    expect(transaction.userRole.count).toHaveBeenCalledWith({ where: { role: AppRole.ADMIN } });
    expect(transaction.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'other-admin-id', role: AppRole.ADMIN },
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
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'audit-id' }) };
    const supabase = {
      createAdminUser: jest.fn().mockResolvedValue(user),
      deleteAdminUser: jest.fn(),
    };
    const service = new AdminService(prisma as never, audit as never, supabase as never);

    const result = await service.createStaffUser(
      'admin-id',
      { email: 'STAFF@EXAMPLE.COM', fullName: 'Store Staff', role: AppRole.WAREHOUSE_MANAGER },
      { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    );

    expect(supabase.createAdminUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'staff@example.com',
        fullName: 'Store Staff',
        password: expect.stringMatching(/^[A-Za-z0-9_-]{24}$/),
      }),
    );
    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'staff-id', role: AppRole.CUSTOMER },
    });
    expect(result).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          email: 'staff@example.com',
          roles: [AppRole.WAREHOUSE_MANAGER],
        }),
        temporaryPassword: expect.stringMatching(/^[A-Za-z0-9_-]{24}$/),
      }),
    );
  });
});
