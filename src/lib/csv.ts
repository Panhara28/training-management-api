// Minimal CSV builder — no new dependency needed for a feature this small.
// Prefixing the output with a UTF-8 BOM makes Excel open Khmer text correctly
// instead of mangling it as if it were the system codepage.
export const CSV_BOM = '﻿';

type CellValue = string | number | boolean | Date | null | undefined;

function escapeCell(value: CellValue): string {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T extends Record<string, CellValue>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','));
  return CSV_BOM + [headerLine, ...lines].join('\r\n') + '\r\n';
}
