import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  it('scopes address updates to the authenticated user', async () => {
    const address = {
      id: 'address-id',
      userId: 'user-id',
      label: 'Home',
    };
    const transaction = {
      address: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(address),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const service = new CustomersService(prisma as never);

    await expect(
      service.updateAddress('user-id', 'address-id', { label: 'Home' }),
    ).resolves.toEqual(address);
    expect(transaction.address.updateMany).toHaveBeenCalledWith({
      where: { id: 'address-id', userId: 'user-id' },
      data: { label: 'Home', country: undefined },
    });
    expect(transaction.address.findFirst).toHaveBeenCalledWith({
      where: { id: 'address-id', userId: 'user-id' },
    });
  });

  it('does not update an address owned by another customer', async () => {
    const transaction = {
      address: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const service = new CustomersService(prisma as never);

    await expect(
      service.updateAddress('user-id', 'other-address-id', { label: 'Work' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.address.findFirst).not.toHaveBeenCalled();
  });
});
