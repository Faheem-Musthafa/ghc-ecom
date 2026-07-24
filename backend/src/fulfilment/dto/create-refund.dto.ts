import { IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class CreateRefundDto {
  @IsUUID()
  paymentId!: string;

  @IsOptional()
  @IsUUID()
  returnRequestId?: string;

  @IsInt()
  @Min(1)
  amountPaise!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{10,100}$/)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
