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
    const service = new AdminService(prisma as never, audit as never);

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
});
