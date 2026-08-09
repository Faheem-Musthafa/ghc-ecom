import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  it('scopes address updates to the authenticated user', async () => {
    const address = {
      id: 'address-id',
      userId: 'user-id',
      label: 'Home',
    };
    const prisma = {
      address: {
        update: jest.fn().mockResolvedValue(address),
      },
    };
    const service = new CustomersService(prisma as never);

    await expect(
      service.updateAddress('user-id', 'address-id', { label: 'Home' }),
    ).resolves.toEqual(address);
    expect(prisma.address.update).toHaveBeenCalledWith({
      where: { id: 'address-id', userId: 'user-id' },
      data: { label: 'Home', country: undefined },
    });
  });

  it('does not update an address owned by another customer', async () => {
    const prisma = {
      address: {
        update: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Address not found', {
            code: 'P2025',
            clientVersion: '6.19.3',
          }),
        ),
      },
    };
    const service = new CustomersService(prisma as never);

    await expect(
      service.updateAddress('user-id', 'other-address-id', { label: 'Work' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.address.update).toHaveBeenCalledTimes(1);
  });
});
