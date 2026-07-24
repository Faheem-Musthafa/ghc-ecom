import { Invoice, Order, OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  const order = {
    id: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    orderNumber: 'GHC-TEST-1',
    status: OrderStatus.CONFIRMED,
    itemsSnapshot: [
      {
        sku: 'SKU-1',
        productName: 'Herbal Product',
        variantName: '100g',
        quantity: 2,
        unitPricePaise: 10_000,
        lineTotalPaise: 20_000,
      },
    ],
    addressSnapshot: { recipientName: 'Customer' },
    subtotalPaise: 20_000,
    discountPaise: 1_000,
    shippingPaise: 900,
    taxPaise: 3_420,
    totalPaise: 23_320,
  } as unknown as Order;
  let prisma: {
    invoice: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let supabase: {
    uploadPrivateDocument: jest.Mock;
    removePrivateDocuments: jest.Mock;
    createPrivateDocumentUrl: jest.Mock;
  };
  let service: InvoiceService;

  beforeEach(() => {
    prisma = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Invoice }) =>
            Promise.resolve({ ...data, id: 'invoice-1' }),
          ),
      },
    };
    supabase = {
      uploadPrivateDocument: jest.fn().mockResolvedValue(undefined),
      removePrivateDocuments: jest.fn().mockResolvedValue(undefined),
      createPrivateDocumentUrl: jest.fn().mockResolvedValue('https://signed.example/invoice'),
    };
    service = new InvoiceService(
      prisma as unknown as PrismaService,
      supabase as unknown as SupabaseService,
    );
  });

  it('generates one PDF and stores it in the private bucket', async () => {
    await service.ensure(order);

    const upload = supabase.uploadPrivateDocument.mock.calls[0] as [string, Buffer, string];
    expect(upload[0]).toMatch(new RegExp(`^invoices/${order.id}/.+\\.pdf$`));
    expect(upload[1].subarray(0, 4).toString()).toBe('%PDF');
    expect(upload[2]).toBe('application/pdf');
    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: order.id,
        number: `INV-${order.orderNumber}`,
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
  });

  it('reuses an existing invoice without uploading another object', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'invoice-existing' });

    await expect(service.ensure(order)).resolves.toEqual({ id: 'invoice-existing' });
    expect(supabase.uploadPrivateDocument).not.toHaveBeenCalled();
  });
});
