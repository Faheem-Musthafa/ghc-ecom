import { Module } from '@nestjs/common';
import { AdminCatalogueController } from './admin-catalogue.controller';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';
import { ImageProcessorService } from './image-processor.service';
import { VideoProcessorService } from './video-processor.service';
import { GoogleDriveImageService } from './google-drive-image.service';

@Module({
  controllers: [CatalogueController, AdminCatalogueController],
  providers: [
    CatalogueService,
    ImageProcessorService,
    VideoProcessorService,
    GoogleDriveImageService,
  ],
})
export class CatalogueModule {}
