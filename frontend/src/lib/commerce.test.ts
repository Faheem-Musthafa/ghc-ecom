import { describe, expect, it } from 'vitest';
import { rupees } from './commerce';

describe('rupees', () => {
    it('formats integer rupee prices without unnecessary decimal places', () => {
        expect(rupees(129_900)).toBe('₹1,299');
    });

    it('preserves paise instead of rounding them away', () => {
        expect(rupees(1_299)).toBe('₹12.99');
        expect(rupees(7)).toBe('₹0.07');
    });
});
