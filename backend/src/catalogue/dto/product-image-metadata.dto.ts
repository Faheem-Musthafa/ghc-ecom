import { IsOptional, IsUUID } from 'class-validator';
import { ImageMetadataDto } from './image-metadata.dto';

export class ProductImageMetadataDto extends ImageMetadataDto {
  @IsOptional()
  @IsUUID()
  variantId?: string;
}
