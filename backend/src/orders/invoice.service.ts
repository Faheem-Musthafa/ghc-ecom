import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Invoice, Order, Prisma } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaService } from '../database/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';

interface InvoiceLine {
  sku?: string;
  productName?: string;
  color?: string;
  quantity?: number;
  unitPricePaise?: number;
  lineTotalPaise?: number;
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async ensure(order: Order): Promise<Invoice> {
    const existing = await this.prisma.invoice.findUnique({ where: { orderId: order.id } });
    if (existing) {
      return existing;
    }
    const pdf = await this.generate(order);
    const number = `INV-${order.orderNumber}`;
    const storagePath = `invoices/${order.id}/${randomUUID()}.pdf`;
    await this.supabase.uploadPrivateDocument(storagePath, pdf, 'application/pdf');
    try {
      return await this.prisma.invoice.create({
        data: {
          orderId: order.id,
          number,
          storagePath,
          bytes: pdf.length,
          sha256: createHash('sha256').update(pdf).digest('hex'),
        },
      });
    } catch (error) {
      await this.supabase.removePrivateDocuments([storagePath]);
      const raced = await this.prisma.invoice.findUnique({ where: { orderId: order.id } });
      if (raced) {
        return raced;
      }
      throw error;
    }
  }

  signedUrl(storagePath: string): Promise<string> {
    return this.supabase.createPrivateDocumentUrl(storagePath, 300);
  }

  private async generate(order: Order): Promise<Buffer> {
    const document = await PDFDocument.create();
    const page = document.addPage([595, 842]);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const lines = this.lines(order.itemsSnapshot);
    let y = 790;
    page.drawText('GHC Ecommerce Invoice', {
      x: 48,
      y,
      size: 20,
      font: bold,
      color: rgb(0.08, 0.18, 0.14),
    });
    y -= 34;
    page.drawText(`Invoice: INV-${order.orderNumber}`, { x: 48, y, size: 10, font: regular });
    y -= 16;
    page.drawText(`Order: ${order.orderNumber}`, { x: 48, y, size: 10, font: regular });
    y -= 28;
    page.drawText('Items', { x: 48, y, size: 13, font: bold });
    y -= 22;
    for (const line of lines) {
      const name = `${line.productName ?? 'Product'}${line.color ? ` — ${line.color}` : ''}`;
      const quantity = line.quantity ?? 0;
      const total = line.lineTotalPaise ?? (line.unitPricePaise ?? 0) * quantity;
      page.drawText(name.slice(0, 65), { x: 48, y, size: 9, font: regular });
      page.drawText(`${quantity} × ${this.money(line.unitPricePaise ?? 0)}`, {
        x: 330,
        y,
        size: 9,
        font: regular,
      });
      page.drawText(this.money(total), { x: 490, y, size: 9, font: regular });
      y -= 18;
    }
    y -= 12;
    const totals = [
      ['Subtotal', order.subtotalPaise],
      ['Discount', -order.discountPaise],
      ['Shipping', order.shippingPaise],
      ['GST', order.taxPaise],
      ['Total', order.totalPaise],
    ] as const;
    for (const [label, amount] of totals) {
      page.drawText(label, { x: 380, y, size: 10, font: label === 'Total' ? bold : regular });
      page.drawText(this.money(amount), {
        x: 490,
        y,
        size: 10,
        font: label === 'Total' ? bold : regular,
      });
      y -= 17;
    }
    return Buffer.from(await document.save());
  }

  private lines(value: Prisma.JsonValue): InvoiceLine[] {
    return Array.isArray(value) ? (value as InvoiceLine[]) : [];
  }

  private money(paise: number): string {
    return `INR ${(paise / 100).toFixed(2)}`;
  }
}
