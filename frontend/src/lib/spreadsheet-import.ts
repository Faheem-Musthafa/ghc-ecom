type SpreadsheetCell = string | number | boolean | Date | null;

export const spreadsheetRowsToCsv = (rows: SpreadsheetCell[][]): string => rows
    .map((row) => row.map((cell) => {
        const value = cell instanceof Date ? cell.toISOString() : String(cell ?? '');
        return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(','))
    .join('\n');

export const readSpreadsheetText = async (file: File): Promise<string> => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) return file.text();
    const { readSheet } = await import('read-excel-file/browser');
    return spreadsheetRowsToCsv(await readSheet(file) as SpreadsheetCell[][]);
};
