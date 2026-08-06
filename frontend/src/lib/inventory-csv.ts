export const inventoryCsvHeaders = ['warehouse_code', 'sku', 'on_hand', 'low_stock_threshold'] as const;

export type InventoryCsvHeader = (typeof inventoryCsvHeaders)[number];
export type InventoryCsvRow = Record<InventoryCsvHeader, string> & { sourceRow: number };

export interface InventoryCsvExportRow {
    warehouseCode: string;
    sku: string;
    onHand: number;
    lowStockThreshold: number;
}

const csvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`;
const csv = (rows: string[][]): string => `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;

export const inventoryCsvTemplate = (): string => csv([
    inventoryCsvHeaders.slice(),
    ['MAIN', 'EXAMPLE-TEA-GOLD', '24', '4'],
    ['MAIN', 'EXAMPLE-TEA-SAGE', '12', '3'],
]);

export const inventoryCsvExport = (rows: InventoryCsvExportRow[]): string => csv([
    inventoryCsvHeaders.slice(),
    ...rows.map((row) => [row.warehouseCode, row.sku, String(row.onHand), String(row.lowStockThreshold)]),
]);

const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    const input = text.replace(/^\uFEFF/, '');

    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];
        if (quoted) {
            if (character === '"' && input[index + 1] === '"') {
                field += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                field += character;
            }
            continue;
        }
        if (character === '"' && field === '') quoted = true;
        else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\n' || character === '\r') {
            if (character === '\r' && input[index + 1] === '\n') index += 1;
            row.push(field);
            if (row.some((value) => value.trim())) rows.push(row);
            row = [];
            field = '';
        } else field += character;
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted cell.');
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
    return rows;
};

export const parseInventoryCsv = (text: string): InventoryCsvRow[] => {
    const rows = parseCsv(text);
    if (!rows.length) throw new Error('CSV is empty.');
    const headers = rows[0].map((header) => header.trim().toLowerCase());
    const missing = inventoryCsvHeaders.filter((header) => !headers.includes(header));
    if (missing.length) throw new Error(`CSV is missing required columns: ${missing.join(', ')}.`);
    return rows.slice(1).map((values, index) =>
        Object.assign(
            { sourceRow: index + 2 },
            Object.fromEntries(inventoryCsvHeaders.map((header) => [header, values[headers.indexOf(header)]?.trim() || ''])),
        ) as unknown as InventoryCsvRow,
    );
};

const nonNegativeInteger = (value: string): boolean => /^\d+$/.test(value);

export const validateInventoryCsvRows = (rows: InventoryCsvRow[]): string[] => {
    if (!rows.length) return ['The CSV has headers but no inventory rows.'];
    const errors: string[] = [];
    const seen = new Map<string, number>();
    for (const row of rows) {
        const prefix = `Row ${row.sourceRow}`;
        if (!row.warehouse_code) errors.push(`${prefix}: warehouse_code is required.`);
        if (!row.sku) errors.push(`${prefix}: sku is required.`);
        if (!nonNegativeInteger(row.on_hand)) errors.push(`${prefix}: on_hand must be a whole number of zero or more.`);
        if (!nonNegativeInteger(row.low_stock_threshold)) errors.push(`${prefix}: low_stock_threshold must be a whole number of zero or more.`);
        const key = `${row.warehouse_code.toUpperCase()}::${row.sku.toUpperCase()}`;
        if (seen.has(key)) errors.push(`${prefix}: duplicates warehouse/SKU from row ${seen.get(key)}.`);
        else seen.set(key, row.sourceRow);
    }
    return errors;
};
