// The one intermediate format every parser produces (CSV, Excel, JSON, PDF
// text, OCR, AI): column names and rows of text cells, each with the line
// number the supplier sees. Pure module.
import { isKnownHeader, normalizeHeader } from './fields';

export type TableRow = {
  /** Line (or record) number in the file, 1 for the first line. */
  number: number;
  /** « Feuille Stock », « page 3 »… when the file has several parts. */
  source: string | null;
  cells: string[];
};

export type ExtractedTable = {
  headers: string[];
  rows: TableRow[];
  /** Lines left out: titles, totals, blank or repeated header lines. */
  skipped: number;
};

const clean = (value: unknown) =>
  (value === null || value === undefined ? '' : String(value))
    .replace(/ | /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** How much a line looks like a header: known column names, few numbers. */
function headerScore(cells: string[]) {
  const filled = cells.filter(Boolean);
  if (filled.length < 2) return 0;
  const known = filled.filter((cell) => isKnownHeader(cell)).length;
  const numeric = filled.filter((cell) => /^[\d\s.,€%-]+$/.test(cell)).length;
  return known * 3 + (filled.length - numeric) - numeric * 2;
}

/** Unique, non-empty column names (« Prix », « Prix (2) », « Colonne 5 »). */
export function uniqueHeaders(cells: string[]) {
  const seen = new Map<string, number>();
  return cells.map((cell, index) => {
    const base = clean(cell) || `Colonne ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count > 1 ? `${base} (${count})` : base;
  });
}

/**
 * Builds the table from raw records: the header is the most header-like line
 * among the first 20 (supplier files often start with a title or a logo row).
 */
export function tableFromRecords(
  records: readonly unknown[][],
  source: string | null = null,
  firstNumber = 1,
): ExtractedTable {
  const lines = records.map((record) => record.map(clean));
  let header = -1;
  let best = 0;
  for (let index = 0; index < Math.min(lines.length, 20); index++) {
    const score = headerScore(lines[index]!);
    if (score > best) {
      best = score;
      header = index;
    }
  }
  if (header < 0) return { headers: [], rows: [], skipped: lines.length };
  const width = Math.max(
    ...lines.slice(header).map((cells) => {
      let last = cells.length;
      while (last > 0 && !cells[last - 1]) last--;
      return last;
    }),
  );
  const headers = uniqueHeaders(
    Array.from({ length: width }, (_, index) => lines[header]![index] ?? ''),
  );
  const normalizedHeader = lines[header]!.map(normalizeHeader).join('|');
  const rows: TableRow[] = [];
  let skipped = header;
  lines.slice(header + 1).forEach((cells, offset) => {
    const padded = Array.from(
      { length: width },
      (_, index) => cells[index] ?? '',
    );
    const filled = padded.filter(Boolean).length;
    // Blank lines and a header repeated on every page are not data.
    if (!filled || cells.map(normalizeHeader).join('|') === normalizedHeader) {
      skipped++;
      return;
    }
    rows.push({
      number: firstNumber + header + 1 + offset,
      source,
      cells: padded,
    });
  });
  return { headers, rows, skipped };
}

/** A file that cannot be read: the message is shown to the administrator. */
export class ImportFileError extends Error {}
