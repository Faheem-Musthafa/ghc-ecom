import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Order } from '@prisma/client';
import { AuthorizationValue } from '../auth/decorators/authorization-value.decorator';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { PaymentIntent, PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('checkout/intent')
  createIntent(
    @Body() input: CreatePaymentIntentDto,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<PaymentIntent> {
    return this.payments.createIntent(input, authorization, guestToken);
  }

  @Post('payments/razorpay/verify')
  verify(@Body() input: VerifyRazorpayPaymentDto): Promise<Order> {
    return this.payments.verifyCheckout(input);
  }
}
