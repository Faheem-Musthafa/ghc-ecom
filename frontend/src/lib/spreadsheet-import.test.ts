import { describe, expect, it } from 'vitest';
import { spreadsheetRowsToCsv } from './spreadsheet-import';

describe('spreadsheet import conversion', () => {
    it('preserves commas, quotes, numbers, and booleans when converting workbook rows', () => {
        expect(spreadsheetRowsToCsv([
            ['name', 'description', 'price', 'active'],
            ['Bowl, Large', 'A "gold" bowl', 1299.5, true],
        ])).toBe('name,description,price,active\n"Bowl, Large","A ""gold"" bowl",1299.5,true');
    });
});
