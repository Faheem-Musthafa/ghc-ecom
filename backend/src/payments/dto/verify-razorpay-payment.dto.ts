import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  razorpayOrderId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  razorpayPaymentId!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  razorpaySignature!: string;
}
