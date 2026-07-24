import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]+$/)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
