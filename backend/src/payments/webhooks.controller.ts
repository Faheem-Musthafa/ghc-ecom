import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.ACCEPTED)
  async razorpay(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') providerEventId?: string,
  ): Promise<{ accepted: true }> {
    if (!request.rawBody || !signature || !providerEventId) {
      throw new UnauthorizedException('Razorpay webhook headers or raw body are missing');
    }
    await this.webhooks.ingest(request.rawBody, signature, providerEventId);
    return { accepted: true };
  }
}
