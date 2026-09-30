// Excel workbooks (.xlsx, .xls) through SheetJS. Cells are read from their
// stored values, never recomputed: formulas give their cached result, dates
// their calendar day, long numbers (EAN) all their digits.
import * as XLSX from 'xlsx';
import { tableFromRecords, type ExtractedTable } from '../table';

export type SheetInfo = { name: string; rows: number };

export type ExcelResult = ExtractedTable & {
  sheet: string;
  sheets: SheetInfo[];
};

const pad = (value: number) => String(value).padStart(2, '0');

/** Number without float noise (0.1 + 0.2), in full (no « 3.76E+12 »). */
function plainNumber(value: number) {
  if (Number.isInteger(value))
    return value.toLocaleString('en-US', {
      useGrouping: false,
      maximumFractionDigits: 0,
    });
  return String(Number(value.toPrecision(12)));
}

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  switch (cell.t) {
    case 's':
      return String(cell.v ?? '');
    case 'b':
      return cell.v ? 'oui' : 'non';
    case 'd':
      return cell.v instanceof Date && Number.isFinite(cell.v.getTime())
        ? cell.v.toISOString().slice(0, 10)
        : String(cell.w ?? '');
    case 'n': {
      const value = Number(cell.v);
      if (!Number.isFinite(value)) return '';
      const format = typeof cell.z === 'string' ? cell.z : '';
      if (format && XLSX.SSF.is_date(format)) {
        const day = XLSX.SSF.parse_date_code(value);
        return day ? `${day.y}-${pad(day.m)}-${pad(day.d)}` : '';
      }
      // 0,055 shown as « 5,5 % »: the rate as the supplier sees it.
      if (format.includes('%')) return `${plainNumber(value * 100)}%`;
      return plainNumber(value);
    }
    default:
      return '';
  }
}

function records(sheet: XLSX.WorkSheet, maxRows: number) {
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  if (!range) return [];
  const last = Math.min(range.e.r, range.s.r + maxRows);
  const lastColumn = Math.min(range.e.c, range.s.c + 150);
  const dense = (sheet as XLSX.DenseWorkSheet)['!data'];
  const result: string[][] = [];
  for (let row = range.s.r; row <= last; row++) {
    const cells: string[] = [];
    for (let column = range.s.c; column <= lastColumn; column++)
      cells.push(
        cellText(
          dense
            ? dense[row]?.[column]
            : (sheet as XLSX.Sheet)[
                XLSX.utils.encode_cell({ r: row, c: column })
              ],
        ),
      );
    result.push(cells);
  }
  return result;
}

/**
 * The chosen sheet, else the one with the most product rows (suppliers often
 * put a cover or conditions sheet first).
 */
export function parseExcel(
  bytes: Uint8Array,
  options: { sheet?: string | null; maxRows: number },
): ExcelResult {
  const workbook = XLSX.read(bytes, {
    type: 'array',
    dense: true,
    cellNF: true,
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
    sheetRows: options.maxRows + 50,
  });
  const tables = workbook.SheetNames.map((name) => ({
    name,
    table: tableFromRecords(
      records(workbook.Sheets[name]!, options.maxRows + 50),
      workbook.SheetNames.length > 1 ? `Feuille ${name}` : null,
    ),
  }));
  const chosen =
    tables.find((sheet) => sheet.name === options.sheet) ??
    tables.reduce<(typeof tables)[number] | null>(
      (best, sheet) =>
        !best || sheet.table.rows.length > best.table.rows.length
          ? sheet
          : best,
      null,
    );
  if (!chosen)
    return { headers: [], rows: [], skipped: 0, sheet: '', sheets: [] };
  return {
    ...chosen.table,
    sheet: chosen.name,
    sheets: tables.map((sheet) => ({
      name: sheet.name,
      rows: sheet.table.rows.length,
    })),
  };
}
