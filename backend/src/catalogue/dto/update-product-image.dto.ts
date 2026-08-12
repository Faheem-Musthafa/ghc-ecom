import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateProductImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  altText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsUUID()
  variantId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  variantIds?: string[];
}
