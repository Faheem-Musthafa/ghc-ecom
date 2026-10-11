import { describe, expect, it } from 'vitest';
import { nextShipmentStatuses, paiseToRupeesInput, parseRupeesToPaise, refundablePaise, returnRefundKey } from './fulfilment';

describe('nextShipmentStatuses', () => {
    it('offers only the transitions the database accepts', () => {
        expect(nextShipmentStatuses('CREATED')).toEqual(['LABEL_CREATED', 'IN_TRANSIT', 'CANCELLED']);
        expect(nextShipmentStatuses('IN_TRANSIT')).toEqual(['OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION']);
        expect(nextShipmentStatuses('DELIVERED')).toEqual([]);
        expect(nextShipmentStatuses('CANCELLED')).toEqual([]);
        expect(Object.values({ a: nextShipmentStatuses('CREATED') }).flat()).not.toContain('PICKED_UP');
    });
});

describe('parseRupeesToPaise', () => {
    it.each([
        ['1299', 129_900],
        ['1,299', 129_900],
        ['₹ 1,299.5', 129_950],
        ['0.01', 1],
        ['Rs. 10', 1_000],
    ])('parses %s', (value, paise) => {
        expect(parseRupeesToPaise(value)).toBe(paise);
    });

    it.each(['', '0', '-5', 'abc', '1.234', '1e3', '12.'])('rejects %s', (value) => {
        expect(parseRupeesToPaise(value)).toBeNull();
    });

    it('round-trips through the input formatter', () => {
        expect(paiseToRupeesInput(129_950)).toBe('1299.50');
        expect(paiseToRupeesInput(129_900)).toBe('1299');
        expect(parseRupeesToPaise(paiseToRupeesInput(129_950))).toBe(129_950);
    });
});

describe('refunds', () => {
    const refund = (status: string, amountPaise: number, returnRequestId: string | null = 'ret-1') => ({
        id: `${status}-${amountPaise}`,
        amountPaise,
        currency: 'INR',
        status,
        returnRequestId,
        createdAt: '2026-10-01T00:00:00.000Z',
    });

    it('subtracts every refund except failed ones', () => {
        expect(
            refundablePaise({
                amountPaise: 10_000,
                refunds: [refund('PROCESSED', 2_000), refund('PENDING', 1_000), refund('FAILED', 5_000)],
            }),
        ).toBe(7_000);
    });

    it('keeps the idempotency key stable until an attempt fails', () => {
        expect(returnRefundKey('ret-1', { refunds: [] })).toBe('return_ret-1_0');
        expect(returnRefundKey('ret-1', { refunds: [refund('PENDING', 1_000)] })).toBe('return_ret-1_0');
        expect(
            returnRefundKey('ret-1', { refunds: [refund('FAILED', 1_000), refund('FAILED', 1_000, 'other')] }),
        ).toBe('return_ret-1_1');
    });
});
