import { ShipmentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackingEventDto {
  @IsString()
  @MaxLength(200)
  providerEventId!: string;

  @IsEnum(ShipmentStatus)
  status!: ShipmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsDateString()
  occurredAt!: string;
}
