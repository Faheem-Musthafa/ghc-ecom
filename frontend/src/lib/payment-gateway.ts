import { FssPaymentIntent } from '../types';

export type PaymentGateway = 'razorpay' | 'fss';

/** Build-time switch; defaults to Razorpay so production is unchanged until the bank kit is live. */
export function resolvePaymentGateway(value: string | undefined = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY): PaymentGateway {
    return value?.trim().toLowerCase() === 'fss' ? 'fss' : 'razorpay';
}

export const PAYMENT_GATEWAY_LABEL: Record<PaymentGateway, string> = {
    razorpay: 'Secure Razorpay Checkout',
    fss: 'Secure Bank Checkout',
};

/**
 * Builds the auto-submitting form that hands the customer to the bank hosted page.
 * Field values are set through DOM properties (never markup) so gateway data cannot
 * inject HTML.
 */
export function buildGatewayForm(intent: FssPaymentIntent, doc: Document = document): HTMLFormElement {
    const form = doc.createElement('form');
    form.method = intent.gateway.method;
    form.action = intent.gateway.url;
    form.style.display = 'none';
    form.dataset.paymentGateway = 'fss';
    for (const [name, value] of Object.entries(intent.gateway.fields)) {
        const input = doc.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }
    return form;
}

export function submitGatewayForm(intent: FssPaymentIntent): void {
    if (!/^https:\/\//i.test(intent.gateway.url)) {
        throw new Error('Bank gateway URL must use HTTPS.');
    }
    const form = buildGatewayForm(intent);
    document.body.appendChild(form);
    form.submit();
}
