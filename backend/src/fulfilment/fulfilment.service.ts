import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  Prisma,
  ReturnRequest,
  ReturnStatus,
  Shipment,
  ShipmentStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ReviewReturnDto } from './dto/review-return.dto';
import { TrackingEventDto } from './dto/tracking-event.dto';
import { ShippingProviderService } from './shipping-provider.service';

const shipmentInclude = {
  items: true,
  events: { orderBy: { occurredAt: 'asc' as const } },
} satisfies Prisma.ShipmentInclude;

export type ShipmentDetail = Prisma.ShipmentGetPayload<{
  include: typeof shipmentInclude;
}>;

@Injectable()
export class FulfilmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ShippingProviderService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async createShipment(
    actorId: string,
    orderId: string,
    input: CreateShipmentDto,
  ): Promise<Shipment> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException('Order must be processing before shipment creation');
    }
    const provider = await this.provider.create(order, input.carrier);
    const shipment = await this.prisma.shipment.create({
      data: {
        orderId,
        ...provider,
        addressSnapshot: this.json(order.addressSnapshot),
        items: { create: this.provider.items(order.itemsSnapshot) },
      },
    });
    await this.audit.record({
      actorId,
      action: 'shipment.created',
      entityType: 'shipment',
      entityId: shipment.id,
      metadata: { orderId, provider: provider.provider },
    });
    return shipment;
  }

  listMine(userId: string, orderId: string): Promise<ShipmentDetail[]> {
    return this.prisma.shipment.findMany({
      where: { orderId, order: { userId } },
      include: shipmentInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async addTrackingEvent(
    actorId: string,
    shipmentId: string,
    input: TrackingEventDto,
  ): Promise<Shipment> {
    const target = input.status.toLowerCase();
    try {
      await this.prisma.$executeRaw`select public.advance_shipment_status(
        ${shipmentId}::uuid,
        ${input.providerEventId},
        ${target}::public.shipment_status,
        ${input.message ?? null},
        ${input.location ?? null},
        ${new Date(input.occurredAt)}::timestamptz
      )`;
    } catch {
      throw new BadRequestException('Shipment state transition is not allowed');
    }
    await this.audit.record({
      actorId,
      action: 'shipment.status_changed',
      entityType: 'shipment',
      entityId: shipmentId,
      metadata: { status: input.status, providerEventId: input.providerEventId },
    });
    return this.prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  }

  async requestReturn(
    userId: string,
    orderId: string,
    input: CreateReturnDto,
  ): Promise<ReturnRequest> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { orderId, order: { userId }, status: ShipmentStatus.DELIVERED },
      orderBy: { deliveredAt: 'desc' },
    });
    if (!shipment?.deliveredAt) throw new BadRequestException('Order has not been delivered');
    const returnWindowDays = this.config.getOrThrow<number>('RETURN_WINDOW_DAYS');
    const eligibleUntil = new Date(
      shipment.deliveredAt.getTime() + returnWindowDays * 24 * 60 * 60 * 1000,
    );
    if (eligibleUntil <= new Date()) {
      throw new BadRequestException('Return eligibility window has expired');
    }
    const active = await this.prisma.returnRequest.findFirst({
      where: {
        orderId,
        status: {
          in: [
            ReturnStatus.REQUESTED,
            ReturnStatus.APPROVED,
            ReturnStatus.RECEIVED,
            ReturnStatus.REFUND_PENDING,
          ],
        },
      },
    });
    if (active) throw new BadRequestException('An active return already exists');
    return this.prisma.returnRequest.create({
      data: { orderId, userId, reason: input.reason, eligibleUntil },
    });
  }

  async reviewReturn(
    actorId: string,
    returnId: string,
    input: ReviewReturnDto,
  ): Promise<ReturnRequest> {
    const request = await this.prisma.returnRequest.findUnique({ where: { id: returnId } });
    if (!request) throw new NotFoundException('Return request not found');
    const allowed =
      (request.status === ReturnStatus.REQUESTED &&
        (input.status === ReturnStatus.APPROVED || input.status === ReturnStatus.REJECTED)) ||
      (request.status === ReturnStatus.APPROVED && input.status === ReturnStatus.RECEIVED);
    if (!allowed) throw new BadRequestException('Return state transition is not allowed');
    const updated = await this.prisma.returnRequest.update({
      where: { id: returnId },
      data: {
        status: input.status,
        reviewNote: input.note,
        reviewedBy: actorId,
        reviewedAt: new Date(),
        receivedAt: input.status === ReturnStatus.RECEIVED ? new Date() : undefined,
      },
    });
    await this.audit.record({
      actorId,
      action: 'return.status_changed',
      entityType: 'return_request',
      entityId: returnId,
      metadata: { from: request.status, to: input.status },
    });
    return updated;
  }

  private json(value: Prisma.JsonValue): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
