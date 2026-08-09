import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Category } from '@prisma/client';
import { CatalogueProduct, CatalogueService, PaginatedProducts } from './catalogue.service';
import { ListProductsDto } from './dto/list-products.dto';

@Controller()
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=45')
  listCategories(): Promise<Category[]> {
    return this.catalogue.listPublicCategories();
  }

  @Get('products')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=45')
  listProducts(@Query() query: ListProductsDto): Promise<PaginatedProducts> {
    return this.catalogue.listPublicProducts(query);
  }

  @Get('products/:slug')
  @Header('Cache-Control', 'public, max-age=15, stale-while-revalidate=45')
  getProduct(@Param('slug') slug: string): Promise<CatalogueProduct> {
    return this.catalogue.getPublicProduct(slug);
  }
}
