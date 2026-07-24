import { Module } from '@nestjs/common';
import { AdminCatalogueController } from './admin-catalogue.controller';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';
import { ImageProcessorService } from './image-processor.service';

@Module({
  controllers: [CatalogueController, AdminCatalogueController],
  providers: [CatalogueService, ImageProcessorService],
})
export class CatalogueModule {}
