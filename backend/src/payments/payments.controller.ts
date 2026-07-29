import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Order } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthorizationValue } from '../auth/decorators/authorization-value.decorator';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentStatusDto } from './dto/payment-status.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { PaymentIntent, PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('checkout/intent')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createIntent(
    @Body() input: CreatePaymentIntentDto,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<PaymentIntent> {
    return this.payments.createIntent(input, authorization, guestToken);
  }

  @Post('payments/razorpay/verify')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  verify(
    @Body() input: VerifyRazorpayPaymentDto,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<Order> {
    return this.payments.verifyCheckout(input, authorization, guestToken);
  }

  @Post('payments/razorpay/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  status(
    @Body() input: PaymentStatusDto,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<Order> {
    return this.payments.resolveCheckoutStatus(input.razorpayOrderId, authorization, guestToken);
  }
}
