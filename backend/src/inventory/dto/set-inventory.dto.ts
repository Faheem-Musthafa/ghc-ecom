import { IsInt, IsUUID, Min } from 'class-validator';

export class SetInventoryDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(0)
  onHand!: number;

  @IsInt()
  @Min(0)
  lowStockThreshold!: number;
}
