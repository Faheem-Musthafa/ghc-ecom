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

  it('normalizes category names before saving them', async () => {
    const category = { id: 'category-id', name: 'Tea Sets', slug: 'tea-sets' };
    const prisma = {
      category: { create: jest.fn().mockResolvedValue(category) },
    };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(
      service.createCategory(
        'actor-id',
        { name: '  Tea   Sets  ', slug: 'tea-sets', isPublished: true },
        {},
      ),
    ).resolves.toEqual(category);
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Tea Sets', slug: 'tea-sets' }),
    });
  });

  it('rejects placeholder categories from the public catalogue', async () => {
    const prisma = { category: { create: jest.fn() } };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(
      service.createCategory('actor-id', { name: 'Test', slug: 'test', isPublished: true }, {}),
    ).rejects.toThrow('Placeholder categories cannot be published');
    expect(prisma.category.create).not.toHaveBeenCalled();
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

  it('creates zero-stock inventory levels for a new variant in every warehouse', async () => {
    const variant = { id: 'variant-id', sku: 'SKU-1' };
    const transaction = {
      productVariant: { create: jest.fn().mockResolvedValue(variant) },
      warehouse: {
        findMany: jest.fn().mockResolvedValue([{ id: 'warehouse-a' }, { id: 'warehouse-b' }]),
      },
      inventoryLevel: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    };
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
        { sku: 'sku-1', name: 'Standard', pricePaise: 10_000 },
        {},
      ),
    ).resolves.toEqual(variant);

    expect(transaction.inventoryLevel.createMany).toHaveBeenCalledWith({
      data: [
        { warehouseId: 'warehouse-a', variantId: 'variant-id' },
        { warehouseId: 'warehouse-b', variantId: 'variant-id' },
      ],
    });
  });

  it('adds a direct HTTPS product video to the product gallery', async () => {
    const video = { id: 'video-id', url: 'https://cdn.example.com/product.mp4' };
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: 'product-id' }) },
      productVideo: { create: jest.fn().mockResolvedValue(video) },
    };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(
      service.addProductVideoUrl(
        'actor-id',
        'product-id',
        { url: 'https://cdn.example.com/product.mp4', altText: 'Product walkthrough' },
        {},
      ),
    ).resolves.toEqual(video);

    expect(prisma.productVideo.create).toHaveBeenCalledWith({
      data: {
        productId: 'product-id',
        url: 'https://cdn.example.com/product.mp4',
        altText: 'Product walkthrough',
        sortOrder: 0,
      },
    });
  });

  it('assigns a product image only to a variant owned by that product', async () => {
    const image = { id: 'image-id', productId: 'product-id', variantId: null };
    const updated = { ...image, variantId: 'variant-id' };
    const prisma = {
      productImage: {
        findFirst: jest.fn().mockResolvedValue(image),
        update: jest.fn().mockResolvedValue(updated),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({ id: 'variant-id' }),
      },
    };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(
      service.updateProductImage(
        'actor-id',
        'product-id',
        'image-id',
        { variantId: 'variant-id' },
        {},
      ),
    ).resolves.toEqual(updated);
    expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 'variant-id', productId: 'product-id' },
      select: { id: true },
    });
  });

  it('rejects an image assignment to another product variant', async () => {
    const prisma = {
      productImage: {
        findFirst: jest.fn().mockResolvedValue({ id: 'image-id', productId: 'product-id' }),
        update: jest.fn(),
      },
      productVariant: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(
      service.updateProductImage(
        'actor-id',
        'product-id',
        'image-id',
        { variantId: 'other-variant-id' },
        {},
      ),
    ).rejects.toThrow('Image variant does not belong to this product');
    expect(prisma.productImage.update).not.toHaveBeenCalled();
  });
});
