import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @IsString()
  @IsNotEmpty()
  razorpayOrderId!: string;

  @IsString()
  @IsNotEmpty()
  razorpayPaymentId!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  razorpaySignature!: string;
}
