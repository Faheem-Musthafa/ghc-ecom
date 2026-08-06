import { describe, expect, it } from 'vitest';
import { inventoryCsvExport, inventoryCsvTemplate, parseInventoryCsv, validateInventoryCsvRows } from './inventory-csv';

describe('inventory CSV', () => {
    it('exports and parses warehouse inventory rows', () => {
        const [row] = parseInventoryCsv(inventoryCsvExport([{ warehouseCode: 'MAIN', sku: 'GHC-SET', onHand: 24, lowStockThreshold: 4 }]));
        expect(row).toMatchObject({ warehouse_code: 'MAIN', sku: 'GHC-SET', on_hand: '24', low_stock_threshold: '4' });
    });

    it('provides a valid import template and catches unsafe stock values', () => {
        expect(validateInventoryCsvRows(parseInventoryCsv(inventoryCsvTemplate()))).toEqual([]);
        const [row] = parseInventoryCsv(inventoryCsvTemplate());
        expect(validateInventoryCsvRows([{ ...row, on_hand: '-1', low_stock_threshold: '2.5', sourceRow: 2 }])).toEqual([
            'Row 2: on_hand must be a whole number of zero or more.',
            'Row 2: low_stock_threshold must be a whole number of zero or more.',
        ]);
    });
});
