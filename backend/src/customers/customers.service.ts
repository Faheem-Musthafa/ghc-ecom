import { Injectable, NotFoundException } from '@nestjs/common';
import { Address, Profile } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<Profile> {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  updateProfile(userId: string, input: UpdateProfileDto): Promise<Profile> {
    return this.prisma.profile.update({
      where: { id: userId },
      data: input,
    });
  }

  listAddresses(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(userId: string, input: CreateAddressDto): Promise<Address> {
    return this.prisma.$transaction(async (transaction) => {
      if (input.isDefault) {
        await transaction.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return transaction.address.create({
        data: {
          ...input,
          country: input.country?.toUpperCase() ?? 'IN',
          userId,
        },
      });
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    input: UpdateAddressDto,
  ): Promise<Address> {
    return this.prisma.$transaction(async (transaction) => {
      if (input.isDefault) {
        await transaction.address.updateMany({
          where: { userId, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      const result = await transaction.address.updateMany({
        where: { id: addressId, userId },
        data: {
          ...input,
          country: input.country?.toUpperCase(),
        },
      });
      if (result.count !== 1) {
        throw new NotFoundException('Address not found');
      }

      const address = await transaction.address.findFirst({
        where: { id: addressId, userId },
      });
      if (!address) {
        throw new NotFoundException('Address not found');
      }
      return address;
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const result = await this.prisma.address.deleteMany({
      where: { id: addressId, userId },
    });
    if (result.count !== 1) {
      throw new NotFoundException('Address not found');
    }
  }
}
