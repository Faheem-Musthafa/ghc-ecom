import { describe, expect, it } from 'vitest';
import { formatRazorpayContact, resolveCheckoutEmail } from './razorpay';

describe('resolveCheckoutEmail', () => {
    it('uses the signed-in email when the saved-address form has no email field', () => {
        expect(resolveCheckoutEmail(null, ' customer@example.com ')).toBe('customer@example.com');
    });
});

describe('formatRazorpayContact', () => {
    it('adds the Indian country code to a local mobile number', () => {
        expect(formatRazorpayContact('98765 43210')).toBe('+919876543210');
    });

    it('normalizes Indian numbers that already include a country or trunk code', () => {
        expect(formatRazorpayContact('+91 98765-43210')).toBe('+919876543210');
        expect(formatRazorpayContact('09876543210')).toBe('+919876543210');
    });
});
