import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, Prisma } from '@prisma/client';

export interface ProviderShipment {
  provider: string;
  providerShipmentId?: string;
  trackingNumber?: string;
  carrier?: string;
}

@Injectable()
export class ShippingProviderService {
  private readonly name: string;
  private readonly url?: string;
  private readonly token?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.name = config.getOrThrow<string>('SHIPPING_PROVIDER_NAME');
    this.url = config.get<string>('SHIPPING_PROVIDER_URL');
    this.token = config.get<string>('SHIPPING_PROVIDER_TOKEN');
    this.timeoutMs = config.get<number>('OUTBOUND_TIMEOUT_MS') ?? 10_000;
  }

  async create(order: Order, carrier?: string): Promise<ProviderShipment> {
    if (!this.url) {
      return { provider: this.name, carrier };
    }
    const response = await fetch(`${this.url.replace(/\/$/, '')}/shipments`, {
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({
        referenceId: order.id,
        orderNumber: order.orderNumber,
        address: order.addressSnapshot,
        items: order.itemsSnapshot,
        carrier,
      }),
    });
    if (!response.ok) {
      throw new BadGatewayException(`Shipping provider returned ${response.status}`);
    }
    const data = (await response.json()) as {
      id?: string;
      trackingNumber?: string;
      carrier?: string;
    };
    return {
      provider: this.name,
      providerShipmentId: data.id,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier ?? carrier,
    };
  }

  items(value: Prisma.JsonValue): Array<{
    variantId?: string;
    sku: string;
    quantity: number;
  }> {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const row = item as Record<string, Prisma.JsonValue>;
      if (typeof row.sku !== 'string' || typeof row.quantity !== 'number') return [];
      return [
        {
          variantId: typeof row.variantId === 'string' ? row.variantId : undefined,
          sku: row.sku,
          quantity: row.quantity,
        },
      ];
    });
  }
}
