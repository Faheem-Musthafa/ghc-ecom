import { IsUrl, MaxLength } from 'class-validator';
import { ProductImageMetadataDto } from './product-image-metadata.dto';

export class ImportGoogleDriveImageDto extends ProductImageMetadataDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2_048)
  driveUrl!: string;
}
