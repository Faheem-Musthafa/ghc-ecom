export function resolveCheckoutEmail(formEmail: string | null, sessionEmail?: string): string {
    return (formEmail ?? sessionEmail ?? '').trim();
}

export function formatRazorpayContact(phone: string, country = 'IN'): string {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (country.toUpperCase() === 'IN') {
        if (digits.length === 10) return `+91${digits}`;
        if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
        if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    }

    return trimmed.startsWith('+') && digits ? `+${digits}` : trimmed;
}
