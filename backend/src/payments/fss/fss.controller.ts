import { Body, Controller, Get, Headers, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Order } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthorizationValue } from '../../auth/decorators/authorization-value.decorator';
import { CreateFssIntentDto } from './dto/create-fss-intent.dto';
import { FssStatusDto } from './dto/fss-status.dto';
import { FssGatewayService } from './fss-gateway.service';
import { FssPaymentIntent, FssPaymentsService } from './fss-payments.service';

/**
 * FSS bank gateway (redirect flow).
 *
 * `payments/fss/response` and `payments/fss/error` are the URLs registered with
 * the bank. They are CSRF-exempt (see CsrfService) because the bank posts to
 * them cross-site, and they never fail with an HTTP error so the customer is
 * always sent to a result page.
 */
@Controller()
export class FssController {
  constructor(
    private readonly payments: FssPaymentsService,
    private readonly gateway: FssGatewayService,
  ) {}

  @Post('checkout/fss/intent')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createIntent(
    @Body() input: CreateFssIntentDto,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<FssPaymentIntent> {
    return this.payments.createIntent(input, authorization, guestToken);
  }

  @Post('payments/fss/response')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  response(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.complete(request, response);
  }

  @Post('payments/fss/error')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  error(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.complete(request, response);
  }

  // Some gateways return the customer with a GET redirect instead of a POST.
  @Get('payments/fss/response')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  responseRedirect(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.complete(request, response);
  }

  @Get('payments/fss/error')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  errorRedirect(@Req() request: Request, @Res() response: Response): Promise<void> {
    return this.complete(request, response);
  }

  @Post('payments/fss/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  status(
    @Body() input: FssStatusDto,
    @AuthorizationValue() authorization?: string,
    @Headers('x-cart-token') guestToken?: string,
  ): Promise<Order> {
    return this.payments.resolveStatus(input.orderId, authorization, guestToken);
  }

  private async complete(request: Request, response: Response): Promise<void> {
    const body = FssController.payload(request.body, request.query);
    const redirectUrl = await this.payments.handleGatewayResponse(body);
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'GET' || this.gateway.usesHttpRedirect()) {
      response.redirect(303, redirectUrl);
      return;
    }
    // FSS convention: the merchant response body tells the gateway where to send
    // the customer's browser next.
    response.status(200).type('text/plain').send(`REDIRECT=${redirectUrl}`);
  }

  private static payload(
    body: unknown,
    query: Request['query'] | Record<string, unknown>,
  ): Record<string, unknown> {
    const fromBody = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    return { ...(query as Record<string, unknown>), ...fromBody };
  }
}
