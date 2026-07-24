import { Controller, Get, Param, Query } from '@nestjs/common';
import { Category } from '@prisma/client';
import { CatalogueProduct, CatalogueService, PaginatedProducts } from './catalogue.service';
import { ListProductsDto } from './dto/list-products.dto';

@Controller()
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('categories')
  listCategories(): Promise<Category[]> {
    return this.catalogue.listPublicCategories();
  }

  @Get('products')
  listProducts(@Query() query: ListProductsDto): Promise<PaginatedProducts> {
    return this.catalogue.listPublicProducts(query);
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string): Promise<CatalogueProduct> {
    return this.catalogue.getPublicProduct(slug);
  }
}
