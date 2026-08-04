import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVariantDto {
  @IsString()
  @MaxLength(80)
  @Matches(/^[A-Z0-9][A-Z0-9._-]*$/)
  sku!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  barcode?: string | null;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(0)
  pricePaise!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  compareAtPricePaise?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  color?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  colorHex?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
