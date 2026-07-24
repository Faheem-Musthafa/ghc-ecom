import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CheckoutQuote } from '@prisma/client';
import { AuthorizationValue } from '../auth/decorators/authorization-value.decorator';
import { CheckoutService } from './checkout.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('quote')
  createQuote(
    @Body() input: CreateQuoteDto,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<CheckoutQuote> {
    return this.checkout.createQuote(input, authorization, guestToken);
  }
}
