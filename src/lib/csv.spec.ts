import { CSV_BOM, toCsv } from './csv';

describe('toCsv', () => {
  const columns = [
    { key: 'name' as const, header: 'Name' },
    { key: 'note' as const, header: 'Note' },
  ];

  it('starts with a UTF-8 BOM so Excel opens Khmer text correctly', () => {
    const csv = toCsv([{ name: 'សុខ ដារ៉ា', note: 'ok' }], columns);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain('សុខ ដារ៉ា');
  });

  it('writes the header row from the column definitions, in order', () => {
    const csv = toCsv([], columns);
    expect(csv.slice(CSV_BOM.length).split('\r\n')[0]).toBe('Name,Note');
  });

  it('quotes and escapes cells containing commas, quotes or newlines', () => {
    const csv = toCsv([{ name: 'Doe, Jane', note: 'said "hi"\nbye' }], columns);
    const body = csv.slice(CSV_BOM.length);
    expect(body).toContain('"Doe, Jane"');
    expect(body).toContain('"said ""hi""\nbye"');
  });

  it('writes null and undefined as empty cells', () => {
    const csv = toCsv([{ name: null, note: undefined }], columns);
    expect(csv.slice(CSV_BOM.length).split('\r\n')[1]).toBe(',');
  });
});
