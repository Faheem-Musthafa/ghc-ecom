import { IsPostalCode, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ShippingAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  recipientName!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  line1!: string;

  @IsString()
  @MaxLength(200)
  line2 = '';

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state!: string;

  @IsPostalCode('any')
  postalCode!: string;

  @IsString()
  @Length(2, 2)
  country = 'IN';
}
