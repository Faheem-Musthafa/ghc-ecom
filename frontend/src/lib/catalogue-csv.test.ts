import { describe, expect, it } from 'vitest';
import {
    catalogueCsvExport,
    catalogueCsvTemplate,
    driveLinksFromCsvCell,
    importRupeesToPaise,
    parseCatalogueCsv,
    validateCatalogueCsvRows,
} from './catalogue-csv';
import { Product } from '../types';

const product: Product = {
    id: 'product-id',
    categoryId: 'category-id',
    name: 'Noir, Gold Set',
    slug: 'noir-gold-set',
    description: 'Quoted "description"',
    status: 'PUBLISHED',
    category: {
        id: 'category-id',
        name: 'Tea Sets',
        slug: 'tea-sets',
        isPublished: true,
        sortOrder: 0,
    },
    variants: [
        {
            id: 'variant-id',
            sku: 'GHC-NOIR-GOLD',
            barcode: '8901234567890',
            name: 'Gold',
            pricePaise: 129_950,
            compareAtPricePaise: 149_900,
            attributes: { color: 'Gold', colorHex: '#C5A059' },
            isActive: true,
        },
    ],
    images: [],
    videos: [],
};

describe('catalogue CSV', () => {
    it('exports existing products and parses them back without losing rupee prices or quoted text', () => {
        const [row] = parseCatalogueCsv(catalogueCsvExport([product]));

        expect(row).toMatchObject({
            product_name: 'Noir, Gold Set',
            description: 'Quoted "description"',
            sku: 'GHC-NOIR-GOLD',
            barcode: '8901234567890',
            price_rupees: '1299.5',
            compare_at_price_rupees: '1499',
        });
    });

    it('provides a header-only downloadable template', () => {
        expect(parseCatalogueCsv(catalogueCsvTemplate())).toEqual([]);
    });

    it('validates categories, duplicate SKUs, prices, and booleans before import', () => {
        const rows = parseCatalogueCsv(catalogueCsvExport([product]));
        rows.push({ ...rows[0], sourceRow: 3, category_slug: 'missing', price_rupees: '12.999', is_active: 'maybe' });

        expect(validateCatalogueCsvRows(rows, new Set(['tea-sets']))).toEqual(
            expect.arrayContaining([
                'Row 3: category_slug “missing” does not exist.',
                'Row 3: sku duplicates row 2.',
                'Row 3: price_rupees must be a non-negative amount with at most two decimals.',
                'Row 3: is_active must be TRUE or FALSE.',
            ]),
        );
    });

    it('converts rupee inputs and pipe-separated Drive links', () => {
        expect(importRupeesToPaise('1299.50')).toBe(129_950);
        expect(importRupeesToPaise('12.999')).toBeUndefined();
        expect(driveLinksFromCsvCell('https://drive.google.com/a | https://drive.google.com/b')).toHaveLength(2);
    });
});
