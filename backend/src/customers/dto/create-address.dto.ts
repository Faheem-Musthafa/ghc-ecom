import {
  IsBoolean,
  IsOptional,
  IsPostalCode,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

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

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
