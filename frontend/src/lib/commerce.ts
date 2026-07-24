import fallbackImageUrl from '../img/canister.webp';

export const rupees = (paise: number) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(Math.round(paise / 100));

export const shortDate = (value: string) =>
    new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export const titleCase = (value: string) =>
    value.toLowerCase().replace(/(^|_|\s)(\w)/g, (_match, space, letter) => `${space ? ' ' : ''}${letter.toUpperCase()}`);

export const fallbackImage = fallbackImageUrl;
