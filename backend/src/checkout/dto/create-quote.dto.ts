import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';
import { ShippingAddressDto } from './shipping-address.dto';

export class CreateQuoteDto {
  @IsUUID()
  cartId!: string;

  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  couponCode?: string;

  @IsEmail()
  contactEmail!: string;
}
