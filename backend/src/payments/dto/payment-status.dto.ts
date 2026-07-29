import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PaymentStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  razorpayOrderId!: string;
}
