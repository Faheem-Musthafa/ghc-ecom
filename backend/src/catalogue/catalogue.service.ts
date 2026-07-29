import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Category,
  Prisma,
  Product,
  ProductImage,
  ProductStatus,
  ProductVariant,
  ProductVideo,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVideoDto } from './dto/create-product-video.dto';
import { CreateVariantDto } from './dto/create-variant.dto';
import { ImageMetadataDto } from './dto/image-metadata.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { ProductImageMetadataDto } from './dto/product-image-metadata.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ImageDerivative, ImageProcessorService } from './image-processor.service';

const productInclude = {
  category: true,
  variants: { orderBy: { createdAt: 'asc' as const } },
  images: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  videos: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
} satisfies Prisma.ProductInclude;

export type CatalogueProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

export interface PaginatedProducts {
  items: CatalogueProduct[];
  total: number;
  page: number;
  limit: number;
}

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

interface StoredDerivative extends ImageDerivative {
  path: string;
  url: string;
}

interface StoredProductImage {
  sourceWidth: number;
  sourceHeight: number;
  derivatives: StoredDerivative[];
}

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  listPublicCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listPublicProducts(query: ListProductsDto): Promise<PaginatedProducts> {
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      publishedAt: { lte: new Date() },
      category: {
        isPublished: true,
        ...(query.category ? { slug: query.category } : {}),
      },
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { shortDescription: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          ...productInclude,
          variants: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async getPublicProduct(slug: string): Promise<CatalogueProduct> {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.PUBLISHED,
        publishedAt: { lte: new Date() },
        category: { isPublished: true },
      },
      include: {
        ...productInclude,
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  listAdminCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  listAdminProducts(): Promise<CatalogueProduct[]> {
    return this.prisma.product.findMany({
      include: productInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAdminProduct(productId: string): Promise<CatalogueProduct> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async createCategory(
    actorId: string,
    input: CreateCategoryDto,
    context: RequestContext,
  ): Promise<Category> {
    const name = this.normalizedCategoryName(input.name);
    this.assertPublishableCategory(name, input.isPublished);
    const category = await this.mutate(() =>
      this.prisma.category.create({
        data: {
          ...input,
          name,
          slug: input.slug.toLowerCase(),
        },
      }),
    );
    await this.auditMutation(
      actorId,
      'catalogue.category.created',
      'category',
      category.id,
      context,
    );
    return category;
  }

  async updateCategory(
    actorId: string,
    categoryId: string,
    input: UpdateCategoryDto,
    context: RequestContext,
  ): Promise<Category> {
    if (input.parentId === categoryId) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    let name = input.name ? this.normalizedCategoryName(input.name) : undefined;
    if (input.isPublished && !name) {
      const existing = await this.prisma.category.findUnique({
        where: { id: categoryId },
        select: { name: true },
      });
      if (!existing) throw new NotFoundException('Category not found');
      name = existing.name;
    }
    this.assertPublishableCategory(name, input.isPublished);
    const category = await this.mutate(
      () =>
        this.prisma.category.update({
          where: { id: categoryId },
          data: {
            ...input,
            name,
            slug: input.slug?.toLowerCase(),
          },
        }),
      'Category',
    );
    await this.auditMutation(
      actorId,
      'catalogue.category.updated',
      'category',
      category.id,
      context,
    );
    return category;
  }

  async deleteCategory(
    actorId: string,
    categoryId: string,
    context: RequestContext,
  ): Promise<void> {
    await this.mutate(() => this.prisma.category.delete({ where: { id: categoryId } }), 'Category');
    await this.auditMutation(
      actorId,
      'catalogue.category.deleted',
      'category',
      categoryId,
      context,
    );
  }

  async createProduct(
    actorId: string,
    input: CreateProductDto,
    context: RequestContext,
  ): Promise<CatalogueProduct> {
    const product = await this.mutate(() =>
      this.prisma.product.create({
        data: this.productData(input),
        include: productInclude,
      }),
    );
    await this.auditMutation(actorId, 'catalogue.product.created', 'product', product.id, context);
    return product;
  }

  async updateProduct(
    actorId: string,
    productId: string,
    input: UpdateProductDto,
    context: RequestContext,
  ): Promise<CatalogueProduct> {
    const product = await this.mutate(
      () =>
        this.prisma.product.update({
          where: { id: productId },
          data: this.productData(input),
          include: productInclude,
        }),
      'Product',
    );
    await this.auditMutation(actorId, 'catalogue.product.updated', 'product', product.id, context);
    return product;
  }

  async deleteProduct(actorId: string, productId: string, context: RequestContext): Promise<void> {
    const [images, videos] = await Promise.all([
      this.prisma.productImage.findMany({ where: { productId } }),
      this.prisma.productVideo.findMany({ where: { productId } }),
    ]);
    await this.mutate(() => this.prisma.product.delete({ where: { id: productId } }), 'Product');
    await this.removeStoredImages(images);
    await this.removeStoredVideos(videos);
    await this.auditMutation(actorId, 'catalogue.product.deleted', 'product', productId, context);
  }

  async createVariant(
    actorId: string,
    productId: string,
    input: CreateVariantDto,
    context: RequestContext,
  ): Promise<ProductVariant> {
    this.validateVariantPrices(input.pricePaise, input.compareAtPricePaise);
    const variant = await this.mutate(() =>
      this.prisma.$transaction(async (transaction) => {
        const { color, colorHex, attributes, ...variantInput } = input;
        const created = await transaction.productVariant.create({
          data: {
            ...variantInput,
            sku: input.sku.toUpperCase(),
            attributes: this.variantAttributes(attributes, color, colorHex),
            productId,
          },
        });
        const warehouses = await transaction.warehouse.findMany({ select: { id: true } });
        if (warehouses.length > 0) {
          await transaction.inventoryLevel.createMany({
            data: warehouses.map((warehouse) => ({
              warehouseId: warehouse.id,
              variantId: created.id,
            })),
          });
        }
        return created;
      }),
    );
    await this.auditMutation(
      actorId,
      'catalogue.variant.created',
      'product_variant',
      variant.id,
      context,
    );
    return variant;
  }

  async updateVariant(
    actorId: string,
    variantId: string,
    input: UpdateVariantDto,
    context: RequestContext,
  ): Promise<ProductVariant> {
    const existing = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!existing) {
      throw new NotFoundException('Product variant not found');
    }
    this.validateVariantPrices(
      input.pricePaise ?? existing.pricePaise,
      input.compareAtPricePaise === undefined
        ? (existing.compareAtPricePaise ?? undefined)
        : input.compareAtPricePaise,
    );
    const variant = await this.mutate(() => {
      const { color, colorHex, attributes, ...variantInput } = input;
      return this.prisma.productVariant.update({
        where: { id: variantId },
        data: {
          ...variantInput,
          sku: input.sku?.toUpperCase(),
          attributes: this.variantAttributes(attributes, color, colorHex, existing.attributes),
        },
      });
    });
    await this.auditMutation(
      actorId,
      'catalogue.variant.updated',
      'product_variant',
      variant.id,
      context,
    );
    return variant;
  }

  async deleteVariant(actorId: string, variantId: string, context: RequestContext): Promise<void> {
    await this.mutate(
      () => this.prisma.productVariant.delete({ where: { id: variantId } }),
      'Product variant',
    );
    await this.auditMutation(
      actorId,
      'catalogue.variant.deleted',
      'product_variant',
      variantId,
      context,
    );
  }

  async addProductImage(
    actorId: string,
    productId: string,
    file: Express.Multer.File,
    metadata: ProductImageMetadataDto,
    context: RequestContext,
  ): Promise<ProductImage> {
    await this.requireProduct(productId);
    await this.requireVariantForProduct(productId, metadata.variantId);
    const image = await this.processAndStoreImage(productId, file);
    try {
      const record = await this.prisma.productImage.create({
        data: this.imageData(productId, file, metadata, image),
      });
      await this.auditMutation(
        actorId,
        'catalogue.image.created',
        'product_image',
        record.id,
        context,
      );
      return record;
    } catch (error) {
      await this.tryRemove(image.derivatives.map(({ path }) => path));
      throw error;
    }
  }

  async replaceProductImage(
    actorId: string,
    productId: string,
    imageId: string,
    file: Express.Multer.File,
    metadata: ProductImageMetadataDto,
    context: RequestContext,
  ): Promise<ProductImage> {
    const previous = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!previous) {
      throw new NotFoundException('Product image not found');
    }
    await this.requireVariantForProduct(productId, metadata.variantId);

    const image = await this.processAndStoreImage(productId, file);
    let replacement: ProductImage;
    try {
      replacement = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.productImage.create({
          data: this.imageData(
            productId,
            file,
            { ...metadata, variantId: metadata.variantId ?? previous.variantId ?? undefined },
            image,
          ),
        });
        await transaction.productImage.delete({ where: { id: previous.id } });
        return created;
      });
    } catch (error) {
      await this.tryRemove(image.derivatives.map(({ path }) => path));
      throw error;
    }

    await this.removeImages(this.imagePaths(previous));
    await this.auditMutation(
      actorId,
      'catalogue.image.replaced',
      'product_image',
      replacement.id,
      context,
      { replacedImageId: previous.id },
    );
    return replacement;
  }

  async updateProductImage(
    actorId: string,
    productId: string,
    imageId: string,
    input: UpdateProductImageDto,
    context: RequestContext,
  ): Promise<ProductImage> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new NotFoundException('Product image not found');
    }
    await this.requireVariantForProduct(productId, input.variantId ?? undefined);
    const updated = await this.prisma.productImage.update({
      where: { id: imageId },
      data: input,
    });
    await this.auditMutation(actorId, 'catalogue.image.updated', 'product_image', imageId, context);
    return updated;
  }

  async deleteProductImage(
    actorId: string,
    productId: string,
    imageId: string,
    context: RequestContext,
  ): Promise<void> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) {
      throw new NotFoundException('Product image not found');
    }
    await this.prisma.productImage.delete({ where: { id: image.id } });
    await this.removeImages(this.imagePaths(image));
    await this.auditMutation(actorId, 'catalogue.image.deleted', 'product_image', imageId, context);
  }

  async addProductVideoUrl(
    actorId: string,
    productId: string,
    input: CreateProductVideoDto,
    context: RequestContext,
  ): Promise<ProductVideo> {
    await this.requireProduct(productId);
    const video = await this.mutate(() =>
      this.prisma.productVideo.create({
        data: {
          productId,
          url: input.url,
          altText: input.altText?.trim() || 'Product video',
          sortOrder: input.sortOrder ?? 0,
        },
      }),
    );
    await this.auditMutation(
      actorId,
      'catalogue.video.created',
      'product_video',
      video.id,
      context,
      {
        source: 'url',
      },
    );
    return video;
  }

  async uploadProductVideo(
    actorId: string,
    productId: string,
    file: Express.Multer.File,
    metadata: ImageMetadataDto,
    context: RequestContext,
  ): Promise<ProductVideo> {
    await this.requireProduct(productId);
    const videoId = randomUUID();
    const storagePath = `${productId}/${videoId}/source${this.videoExtension(file.mimetype)}`;
    try {
      await this.supabase.uploadProductVideo(storagePath, file.buffer, file.mimetype);
    } catch {
      throw new BadGatewayException('Product video storage failed');
    }

    try {
      const video = await this.prisma.productVideo.create({
        data: {
          productId,
          url: this.supabase.getProductVideoPublicUrl(storagePath),
          storagePath,
          sourceFilename: basename(file.originalname).slice(0, 255) || 'upload',
          sourceMimeType: file.mimetype,
          altText: metadata.altText,
          sortOrder: metadata.sortOrder ?? 0,
        },
      });
      await this.auditMutation(
        actorId,
        'catalogue.video.created',
        'product_video',
        video.id,
        context,
        {
          source: 'upload',
        },
      );
      return video;
    } catch (error) {
      await this.tryRemoveVideos([storagePath]);
      throw error;
    }
  }

  async deleteProductVideo(
    actorId: string,
    productId: string,
    videoId: string,
    context: RequestContext,
  ): Promise<void> {
    const video = await this.prisma.productVideo.findFirst({
      where: { id: videoId, productId },
    });
    if (!video) {
      throw new NotFoundException('Product video not found');
    }
    await this.prisma.productVideo.delete({ where: { id: video.id } });
    if (video.storagePath) {
      await this.removeStoredVideos([video]);
    }
    await this.auditMutation(actorId, 'catalogue.video.deleted', 'product_video', videoId, context);
  }

  private productData(
    input: CreateProductDto | UpdateProductDto,
  ): Prisma.ProductUncheckedCreateInput {
    return {
      ...input,
      categoryId: input.categoryId as string,
      name: input.name as string,
      slug: input.slug?.toLowerCase() as string,
      material: input.material === undefined ? undefined : input.material.trim() || null,
      dimensions: input.dimensions === undefined ? undefined : input.dimensions.trim() || null,
      attributes: input.attributes as Prisma.InputJsonValue | undefined,
      publishedAt:
        input.status === ProductStatus.PUBLISHED ? new Date() : input.status ? null : undefined,
    };
  }

  private validateVariantPrices(pricePaise: number, compareAtPricePaise?: number): void {
    if (compareAtPricePaise !== undefined && compareAtPricePaise < pricePaise) {
      throw new BadRequestException('compareAtPricePaise cannot be lower than pricePaise');
    }
  }

  private normalizedCategoryName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  private assertPublishableCategory(name?: string, isPublished?: boolean): void {
    if (isPublished && name && /^(test(?:ing)?|demo|sample|untitled)$/i.test(name)) {
      throw new BadRequestException('Placeholder categories cannot be published');
    }
  }

  private async requireProduct(productId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private async requireVariantForProduct(productId: string, variantId?: string): Promise<void> {
    if (!variantId) return;
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    });
    if (!variant) {
      throw new BadRequestException('Image variant does not belong to this product');
    }
  }

  private async processAndStoreImage(
    productId: string,
    file: Express.Multer.File,
  ): Promise<StoredProductImage> {
    const processed = await this.imageProcessor.process(file);
    const imageId = randomUUID();
    const stored: StoredDerivative[] = [];

    try {
      for (const derivative of processed.derivatives) {
        const path = `${productId}/${imageId}/${derivative.name}.webp`;
        await this.supabase.uploadProductImage(path, derivative.buffer);
        stored.push({
          ...derivative,
          path,
          url: this.supabase.getProductImagePublicUrl(path),
        });
      }
      return {
        sourceWidth: processed.sourceWidth,
        sourceHeight: processed.sourceHeight,
        derivatives: stored,
      };
    } catch {
      await this.tryRemove(stored.map(({ path }) => path));
      throw new BadGatewayException('Product image storage failed');
    }
  }

  private imageData(
    productId: string,
    file: Express.Multer.File,
    metadata: ProductImageMetadataDto,
    image: StoredProductImage,
  ): Prisma.ProductImageUncheckedCreateInput {
    const derivatives = image.derivatives;
    const thumbnail = this.derivative(derivatives, 'thumbnail');
    const medium = this.derivative(derivatives, 'medium');
    const large = this.derivative(derivatives, 'large');
    return {
      productId,
      variantId: metadata.variantId,
      altText: metadata.altText,
      sortOrder: metadata.sortOrder ?? 0,
      sourceFilename: basename(file.originalname).slice(0, 255) || 'upload',
      sourceMimeType: file.mimetype,
      sourceWidth: image.sourceWidth,
      sourceHeight: image.sourceHeight,
      thumbnailPath: thumbnail.path,
      thumbnailUrl: thumbnail.url,
      thumbnailWidth: thumbnail.width,
      thumbnailHeight: thumbnail.height,
      thumbnailBytes: thumbnail.bytes,
      mediumPath: medium.path,
      mediumUrl: medium.url,
      mediumWidth: medium.width,
      mediumHeight: medium.height,
      mediumBytes: medium.bytes,
      largePath: large.path,
      largeUrl: large.url,
      largeWidth: large.width,
      largeHeight: large.height,
      largeBytes: large.bytes,
    };
  }

  private variantAttributes(
    input: Record<string, unknown> | undefined,
    color: string | undefined,
    colorHex: string | undefined,
    existing?: Prisma.JsonValue,
  ): Prisma.InputJsonValue {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
    const attributes = { ...base, ...(input ?? {}) } as Record<string, Prisma.JsonValue>;
    if (color !== undefined) attributes.color = color.trim();
    if (colorHex !== undefined) attributes.colorHex = colorHex.toUpperCase();
    return attributes as Prisma.InputJsonValue;
  }

  private derivative(
    derivatives: StoredDerivative[],
    name: ImageDerivative['name'],
  ): StoredDerivative {
    const derivative = derivatives.find((candidate) => candidate.name === name);
    if (!derivative) {
      throw new Error(`Missing ${name} derivative`);
    }
    return derivative;
  }

  private imagePaths(image: ProductImage): string[] {
    return [image.thumbnailPath, image.mediumPath, image.largePath];
  }

  private async removeStoredImages(images: ProductImage[]): Promise<void> {
    await this.removeImages(images.flatMap((image) => this.imagePaths(image)));
  }

  private async removeStoredVideos(videos: ProductVideo[]): Promise<void> {
    const paths = videos.flatMap((video) => (video.storagePath ? [video.storagePath] : []));
    if (paths.length === 0) {
      return;
    }
    try {
      await this.supabase.removeProductVideos(paths);
    } catch {
      throw new BadGatewayException('Product video cleanup failed');
    }
  }

  private async removeImages(paths: string[]): Promise<void> {
    try {
      await this.supabase.removeProductImages(paths);
    } catch {
      throw new BadGatewayException('Product image cleanup failed');
    }
  }

  private async tryRemove(paths: string[]): Promise<void> {
    try {
      await this.supabase.removeProductImages(paths);
    } catch {
      // Database references are removed or replaced first, so a cleanup failure
      // can leave an orphan but can never leave a broken public image reference.
    }
  }

  private async tryRemoveVideos(paths: string[]): Promise<void> {
    try {
      await this.supabase.removeProductVideos(paths);
    } catch {
      // The video record was never created, so a failed cleanup can only leave an orphaned file.
    }
  }

  private videoExtension(mimeType: string): string {
    switch (mimeType) {
      case 'video/webm':
        return '.webm';
      case 'video/quicktime':
        return '.mov';
      default:
        return '.mp4';
    }
  }

  private async auditMutation(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    context: RequestContext,
    metadata: Prisma.InputJsonValue = {},
  ): Promise<void> {
    await this.audit.record({
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      ...context,
    });
  }

  private async mutate<T>(operation: () => Promise<T>, label = 'Record'): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('A record with that unique value already exists');
        }
        if (error.code === 'P2003') {
          throw new ConflictException(`${label} is still in use`);
        }
        if (error.code === 'P2025') {
          throw new NotFoundException(`${label} not found`);
        }
      }
      throw error;
    }
  }
}
