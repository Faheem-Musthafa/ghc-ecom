import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { CatalogueService } from './catalogue.service';

describe('CatalogueService', () => {
  const audit = { record: jest.fn() };
  const supabase = {
    uploadProductImage: jest.fn(),
    removeProductImages: jest.fn(),
    getProductImagePublicUrl: jest.fn(),
    uploadProductVideo: jest.fn(),
    getProductVideoPublicUrl: jest.fn(),
  };
  const imageProcessor = { process: jest.fn() };
  const videoProcessor = { process: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only published products in published categories with active variants', async () => {
    const products = [{ id: 'product-id', status: ProductStatus.PUBLISHED, variants: [] }];
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
        relationLoadStrategy: 'join',
        where: expect.objectContaining({
          status: ProductStatus.PUBLISHED,
          category: { isPublished: true },
        }),
        include: expect.objectContaining({
          variants: expect.objectContaining({ where: { isActive: true } }),
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ relationLoadStrategy: 'join' }),
    );
  });

  it('serves repeated public catalogue requests from Redis', async () => {
    const products = [{ id: 'product-id', status: ProductStatus.PUBLISHED, variants: [] }];
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue(products),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const values = new Map<string, unknown>();
    const redis = {
      getJson: jest.fn(async (key: string) => values.get(key) ?? null),
      setJson: jest.fn(async (key: string, value: unknown) => {
        values.set(key, value);
      }),
      get: jest.fn().mockResolvedValue('1'),
      increment: jest.fn(),
    };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
      videoProcessor as never,
      redis as never,
    );

    await service.listPublicProducts({ page: 1, limit: 20 });
    await service.listPublicProducts({ page: 1, limit: 20 });

    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.count).toHaveBeenCalledTimes(1);
    expect(redis.setJson).toHaveBeenCalledTimes(1);
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
        { name: '  Tea   Sets  ', isPublished: true },
        {},
      ),
    ).resolves.toEqual(category);
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Tea Sets', slug: 'tea-sets' }),
    });
  });

  it('regenerates the internal category slug when its name changes', async () => {
    const previous = { id: 'category-id', name: 'Tea Sets', slug: 'tea-sets' };
    const category = { id: 'category-id', name: 'Dining Sets', slug: 'dining-sets' };
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue(previous),
        update: jest.fn().mockResolvedValue(category),
      },
    };
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
    );

    await expect(
      service.updateCategory('actor-id', 'category-id', { name: '  Dining Sets  ' }, {}),
    ).resolves.toEqual(category);
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'category-id' },
      data: expect.objectContaining({ name: 'Dining Sets', slug: 'dining-sets' }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'category',
        entityId: 'category-id',
        metadata: {
          entityLabel: 'Dining Sets',
          changes: {
            name: { before: 'Tea Sets', after: 'Dining Sets' },
            slug: { before: 'tea-sets', after: 'dining-sets' },
          },
        },
      }),
    );
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
      service.createCategory('actor-id', { name: 'Test', isPublished: true }, {}),
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
        { sku: 'sku-1', alias: 'gold display', pricePaise: 10_000 },
        {},
      ),
    ).resolves.toEqual(variant);

    expect(transaction.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sku: 'SKU-1',
        alias: 'GOLD DISPLAY',
      }),
    });

    expect(transaction.inventoryLevel.createMany).toHaveBeenCalledWith({
      data: [
        { warehouseId: 'warehouse-a', variantId: 'variant-id' },
        { warehouseId: 'warehouse-b', variantId: 'variant-id' },
      ],
    });
  });

  it('deletes automatically-created zero-stock levels before deleting an unused product', async () => {
    const transaction = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ variants: [{ id: 'variant-id' }] }),
        delete: jest.fn().mockResolvedValue({}),
      },
      inventoryLevel: {
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      cartItem: { count: jest.fn().mockResolvedValue(0) },
      inventoryReservation: { count: jest.fn().mockResolvedValue(0) },
      stockMovement: { count: jest.fn().mockResolvedValue(0) },
    };
    const prisma = {
      productImage: { findMany: jest.fn().mockResolvedValue([]) },
      productVideo: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    audit.record.mockResolvedValue({});
    const service = new CatalogueService(prisma as never, audit as never, supabase as never, imageProcessor as never);

    await service.deleteProduct('actor-id', 'product-id', {});

    expect(transaction.inventoryLevel.deleteMany).toHaveBeenCalledWith({ where: { variantId: { in: ['variant-id'] } } });
    expect(transaction.product.delete).toHaveBeenCalledWith({ where: { id: 'product-id' } });
  });

  it('stores uploaded videos as browser-ready MP4 files', async () => {
    const video = { id: 'video-id', url: 'https://storage.example.com/video.mp4' };
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: 'product-id' }) },
      productVideo: { create: jest.fn().mockResolvedValue(video) },
    };
    videoProcessor.process.mockResolvedValue({
      buffer: Buffer.from('converted-video'),
      mimetype: 'video/mp4',
    });
    supabase.getProductVideoPublicUrl.mockReturnValue(video.url);
    const service = new CatalogueService(
      prisma as never,
      audit as never,
      supabase as never,
      imageProcessor as never,
      videoProcessor as never,
    );

    await expect(
      service.uploadProductVideo(
        'actor-id',
        'product-id',
        {
          buffer: Buffer.from('mov-source'),
          mimetype: 'video/quicktime',
          originalname: 'product.mov',
        } as Express.Multer.File,
        { altText: 'Product walkthrough' },
        {},
      ),
    ).resolves.toEqual(video);

    expect(supabase.uploadProductVideo).toHaveBeenCalledWith(
      expect.stringMatching(/^product-id\/.+\/source\.mp4$/),
      Buffer.from('converted-video'),
      'video/mp4',
    );
    expect(prisma.productVideo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceFilename: 'product.mov',
        sourceMimeType: 'video/mp4',
        storagePath: expect.stringMatching(/^product-id\/.+\/source\.mp4$/),
      }),
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
