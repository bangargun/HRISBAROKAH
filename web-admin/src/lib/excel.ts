import type { Workbook, Worksheet, CellValue } from 'exceljs';

/** exceljs cukup besar; dimuat hanya saat impor/ekspor dipakai. */
export async function newWorkbook(): Promise<Workbook> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  return new ExcelJS.Workbook();
}

export async function downloadWorkbook(wb: Workbook, fileName: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Baris judul tebal dengan latar abu, lebar kolom, dan filter. */
export function styleHeader(ws: Worksheet, widths: number[]) {
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EBEF' } };
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/** Isi sel Excel apa pun (teks, angka, tanggal, rich text, rumus) menjadi teks. */
export function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Tanggal Excel disimpan sebagai UTC tengah malam
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') return Number.isInteger(value) ? value.toFixed(0) : String(value);
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((r) => r.text).join('').trim();
    if ('result' in v) return cellText(v.result as CellValue);
    if ('text' in v) return String(v.text).trim();
  }
  return String(value).trim();
}
