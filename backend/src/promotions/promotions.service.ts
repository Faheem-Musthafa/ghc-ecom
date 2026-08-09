import { BadRequestException, Injectable } from '@nestjs/common';
import { Coupon, DiscountType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { auditChangeMetadata } from '../audit/audit-change';
import { PrismaService } from '../database/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<Coupon[]> {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(actorId: string, input: CreateCouponDto): Promise<Coupon> {
    this.validate(input);
    const coupon = await this.prisma.coupon.create({
      data: {
        ...input,
        code: input.code.toUpperCase(),
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      },
    });
    await this.auditCoupon(actorId, 'promotion.coupon.created', {}, coupon);
    return coupon;
  }

  async update(actorId: string, couponId: string, input: UpdateCouponDto): Promise<Coupon> {
    const existing = await this.prisma.coupon.findUniqueOrThrow({
      where: { id: couponId },
    });
    this.validate({
      type: input.type ?? existing.type,
      value: input.value ?? existing.value,
      startsAt: input.startsAt ?? existing.startsAt.toISOString(),
      endsAt: input.endsAt ?? existing.endsAt.toISOString(),
    });
    const coupon = await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        ...input,
        code: input.code?.toUpperCase(),
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });
    await this.auditCoupon(actorId, 'promotion.coupon.updated', existing, coupon);
    return coupon;
  }

  private validate(input: {
    type: DiscountType;
    value: number;
    startsAt: string;
    endsAt: string;
  }): void {
    if (input.type === DiscountType.PERCENT && input.value > 10_000) {
      throw new BadRequestException('Percentage coupon value cannot exceed 10000 basis points');
    }
    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new BadRequestException('Coupon end date must be after its start date');
    }
  }

  private async auditCoupon(actorId: string, action: string, before: object, coupon: Coupon): Promise<void> {
    await this.audit.record({
      actorId,
      action,
      entityType: 'coupon',
      entityId: coupon.id,
      metadata: auditChangeMetadata(coupon.code, before, coupon, [
        'code',
        'type',
        'value',
        'minimumSubtotalPaise',
        'maximumDiscountPaise',
        'usageLimit',
        'perUserLimit',
        'startsAt',
        'endsAt',
        'isActive',
      ]),
    });
  }
}
