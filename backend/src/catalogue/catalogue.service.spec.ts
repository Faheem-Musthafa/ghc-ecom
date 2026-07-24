import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { CatalogueService } from './catalogue.service';

describe('CatalogueService', () => {
  const audit = { record: jest.fn() };
  const supabase = {
    uploadProductImage: jest.fn(),
    removeProductImages: jest.fn(),
    getProductImagePublicUrl: jest.fn(),
  };
  const imageProcessor = { process: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only published products in published categories with active variants', async () => {
    const products = [{ id: 'product-id', status: ProductStatus.PUBLISHED }];
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue(products),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(service.listPublicProducts({ page: 1, limit: 20 })).resolves.toEqual({
      items: products,
      total: 1,
      page: 1,
      limit: 20,
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ProductStatus.PUBLISHED,
          category: { isPublished: true },
        }),
        include: expect.objectContaining({
          variants: expect.objectContaining({ where: { isActive: true } }),
        }),
      }),
    );
  });

  it('does not return an unpublished product from the public detail API', async () => {
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(service.getPublicProduct('draft-product')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects a compare-at price lower than the selling price', async () => {
    const prisma = { productVariant: { create: jest.fn() } };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(
      service.createVariant(
        'actor-id',
        'product-id',
        {
          sku: 'SKU-1',
          name: 'Default',
          pricePaise: 10_000,
          compareAtPricePaise: 9_000,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productVariant.create).not.toHaveBeenCalled();
  });
});
