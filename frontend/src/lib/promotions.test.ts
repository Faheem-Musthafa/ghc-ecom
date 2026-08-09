import { describe, expect, it } from 'vitest';
import { basisPointsToPercent, localDateBoundaryIso, percentToBasisPoints } from './promotions';

describe('promotion units', () => {
    it('converts the admin-facing percentage to backend basis points and back', () => {
        expect(percentToBasisPoints(15)).toBe(1_500);
        expect(basisPointsToPercent(1_500)).toBe(15);
    });

    it('keeps a selected end date valid through the end of that local day', () => {
        const result = new Date(localDateBoundaryIso('2026-08-08', true));
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(7);
        expect(result.getDate()).toBe(8);
        expect(result.getHours()).toBe(23);
    });
});
