import { describe, expect, it } from 'vitest';
import {
    catalogueCsvHeaders,
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
    shortDescription: 'Legacy short summary',
    description: 'Quoted "description"',
    material: 'Stoneware',
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
            alias: 'NOIR GOLD',
            pricePaise: 129_950,
            compareAtPricePaise: 149_900,
            attributes: { color: 'Gold', colorHex: '#C5A059' },
            isActive: true,
            availableStock: 4,
        },
    ],
    images: [],
    videos: [],
};

describe('catalogue CSV', () => {
    it('matches every editable text field in Add Product without stale columns', () => {
        expect(catalogueCsvHeaders).toEqual([
            'product_name',
            'category_name',
            'status',
            'description',
            'material',
            'color',
            'color_hex',
            'sku',
            'alias',
            'price_rupees',
            'compare_at_price_rupees',
            'is_active',
            'option_google_drive_image_links',
            'shared_google_drive_image_links',
        ]);
    });

    it('exports existing products and parses them back without losing rupee prices or quoted text', () => {
        const [row] = parseCatalogueCsv(catalogueCsvExport([product]));

        expect(row).toMatchObject({
            product_name: 'Noir, Gold Set',
            category_name: 'Tea Sets',
            description: 'Quoted "description"',
            material: 'Stoneware',
            color: 'Gold',
            color_hex: '#C5A059',
            sku: 'GHC-NOIR-GOLD',
            alias: 'NOIR GOLD',
            price_rupees: '1299.5',
            compare_at_price_rupees: '1499',
            is_active: 'TRUE',
        });
    });

    it('imports the legacy barcode column as the renamed alias field', () => {
        const legacyCsv = catalogueCsvExport([product]).replace(',"alias",', ',"barcode",');
        const [row] = parseCatalogueCsv(legacyCsv);

        expect(row.alias).toBe('NOIR GOLD');
    });

    it('provides a downloadable template with product examples', () => {
        const rows = parseCatalogueCsv(catalogueCsvTemplate());

        expect(rows).toHaveLength(3);
        expect(rows[0]).toMatchObject({
            product_name: 'Noir Gold Tea Set',
            product_slug: 'noir-gold-tea-set',
            sku: 'EXAMPLE-TEA-GOLD',
        });
        expect(rows[2]).toMatchObject({
            product_name: 'Handcrafted Serving Bowl',
            category_name: 'Serveware',
        });
        expect(validateCatalogueCsvRows(rows)).toEqual([]);
    });

    it('allows a new category name so import can create it', () => {
        const rows = parseCatalogueCsv(catalogueCsvExport([product]));
        rows[0].category_name = 'Brand New Category';

        expect(validateCatalogueCsvRows(rows)).toEqual([]);
    });

    it('validates required category names, duplicate SKUs, prices, and booleans before import', () => {
        const rows = parseCatalogueCsv(catalogueCsvExport([product]));
        rows.push({ ...rows[0], sourceRow: 3, category_name: '', price_rupees: '12.999', is_active: 'maybe' });

        expect(validateCatalogueCsvRows(rows)).toEqual(
            expect.arrayContaining([
                'Row 3: category_name is required.',
                'Row 3: sku duplicates row 2.',
                'Row 3: price_rupees must be a non-negative amount with at most two decimals.',
                'Row 3: is_active must be TRUE or FALSE.',
            ]),
        );
    });

    it('allows duplicate aliases and preserves alias text while keeping SKUs unique', () => {
        const rows = parseCatalogueCsv(catalogueCsvExport([product]));
        rows[0].alias = 'Gift set — popular 😊';
        rows.push({
            ...rows[0],
            sourceRow: 3,
            sku: 'GHC-NOIR-SAGE-2',
        });

        expect(validateCatalogueCsvRows(rows)).toEqual([]);
        expect(rows.map((row) => row.alias)).toEqual([
            'Gift set — popular 😊',
            'Gift set — popular 😊',
        ]);
    });

    it('converts rupee inputs and pipe-separated Drive links', () => {
        expect(importRupeesToPaise('1299.50')).toBe(129_950);
        expect(importRupeesToPaise('12.999')).toBeUndefined();
        expect(driveLinksFromCsvCell('https://drive.google.com/a | https://drive.google.com/b')).toHaveLength(2);
    });
});
