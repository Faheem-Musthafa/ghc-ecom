import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class SetCartItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
