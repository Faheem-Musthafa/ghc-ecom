import { describe, expect, it } from 'vitest';
import { FssPaymentIntent } from '../types';
import { buildGatewayForm, resolvePaymentGateway, submitGatewayForm } from './payment-gateway';

const intent: FssPaymentIntent = {
    provider: 'fss',
    orderId: '1b4e28ba-2fa1-11d2-883f-0016d3cca427',
    orderNumber: 'GHC-TEST-1',
    amount: 12_750,
    currency: 'INR',
    gateway: {
        url: 'https://test-gateway.example.bank/PGServlet',
        method: 'POST',
        fields: {
            tranportalId: 'TP0001',
            trandata: 'abcd1234',
            responseURL: 'https://www.glockery.com/api/v1/payments/fss/response',
        },
    },
};

describe('resolvePaymentGateway', () => {
    it('defaults to Razorpay unless the bank gateway is explicitly selected', () => {
        expect(resolvePaymentGateway(undefined)).toBe('razorpay');
        expect(resolvePaymentGateway('')).toBe('razorpay');
        expect(resolvePaymentGateway('razorpay')).toBe('razorpay');
        expect(resolvePaymentGateway(' FSS ')).toBe('fss');
    });
});

describe('buildGatewayForm', () => {
    it('creates a hidden POST form with one input per gateway field', () => {
        const form = buildGatewayForm(intent);

        expect(form.method).toBe('post');
        expect(form.action).toBe(intent.gateway.url);
        expect(form.style.display).toBe('none');
        const inputs = Array.from(form.querySelectorAll('input'));
        expect(inputs.map((input) => [input.type, input.name, input.value])).toEqual([
            ['hidden', 'tranportalId', 'TP0001'],
            ['hidden', 'trandata', 'abcd1234'],
            ['hidden', 'responseURL', 'https://www.glockery.com/api/v1/payments/fss/response'],
        ]);
    });

    it('keeps gateway values as data rather than markup', () => {
        const form = buildGatewayForm({
            ...intent,
            gateway: { ...intent.gateway, fields: { trandata: '"><img src=x onerror=alert(1)>' } },
        });

        expect(form.querySelectorAll('img')).toHaveLength(0);
        expect(form.querySelector('input')?.value).toBe('"><img src=x onerror=alert(1)>');
    });
});

describe('submitGatewayForm', () => {
    it('refuses to post the customer to a non-HTTPS gateway', () => {
        expect(() =>
            submitGatewayForm({ ...intent, gateway: { ...intent.gateway, url: 'http://insecure.example' } }),
        ).toThrow('HTTPS');
        expect(document.querySelector('form[data-payment-gateway]')).toBeNull();
    });
});
