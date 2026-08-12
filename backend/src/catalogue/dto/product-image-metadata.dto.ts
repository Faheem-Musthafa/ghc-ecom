import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ImageMetadataDto } from './image-metadata.dto';

const imageVariantIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

export class ProductImageMetadataDto extends ImageMetadataDto {
  /** @deprecated Accepted for older admin clients; use variantIds. */
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @Transform(({ value }) => imageVariantIds(value))
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  variantIds?: string[];
}
