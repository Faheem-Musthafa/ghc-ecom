import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateShipmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrier?: string;
}
