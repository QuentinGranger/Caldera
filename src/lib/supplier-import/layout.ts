// A table rebuilt from words and their position on the page, for PDF text
// and OCR alike: lines from vertical positions, cells from gaps, columns
// from the header line. Each page gets a confidence score; a page that does
// not look like a table is never guessed. Pure module.
import { isKnownHeader, normalizeHeader } from './fields';
import type { ExtractedTable, TableRow } from './table';

export type Word = {
  text: string;
  /** Points or pixels from the top left corner of the page. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** OCR only: 0 to 100. */
  confidence?: number;
};

export type PageWords = {
  page: number;
  words: Word[];
  /** Shown as the source of each row (« page 3 · OCR »). */
  label?: string;
};

/** A page read by AI: already a table, without positions. */
export type PageTable = {
  page: number;
  headers: string[];
  rows: string[][];
  label?: string;
};

export type PageInput = PageWords | PageTable;

type Cell = { text: string; left: number; right: number };
type Line = { top: number; height: number; cells: Cell[] };

export type PageResult = {
  page: number;
  /** 0 to 1. */
  confidence: number;
  rows: number;
  headerFound: boolean;
  note: string | null;
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

function linesOf(words: Word[]): Line[] {
  const usable = words.filter((word) => word.text.trim() && word.height > 0);
  const size = median(usable.map((word) => word.height)) || 10;
  const sorted = [...usable].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: { top: number; height: number; words: Word[] }[] = [];
  for (const word of sorted) {
    const center = word.top + word.height / 2;
    const line = lines.at(-1);
    if (line && Math.abs(line.top + line.height / 2 - center) < size * 0.6)
      line.words.push(word);
    else lines.push({ top: word.top, height: word.height, words: [word] });
  }
  return lines.map((line) => {
    const ordered = [...line.words].sort((a, b) => a.left - b.left);
    const cells: Cell[] = [];
    for (const word of ordered) {
      const last = cells.at(-1);
      // Words of one cell are closer than the gap between two columns.
      if (last && word.left - last.right < size * 1.1) {
        last.text = `${last.text} ${word.text.trim()}`;
        last.right = Math.max(last.right, word.left + word.width);
      } else
        cells.push({
          text: word.text.trim(),
          left: word.left,
          right: word.left + word.width,
        });
    }
    return { top: line.top, height: line.height, cells };
  });
}

function headerLine(lines: Line[]) {
  let best = -1;
  let bestScore = 0;
  lines.slice(0, 40).forEach((line, index) => {
    if (line.cells.length < 2) return;
    const known = line.cells.filter((cell) => isKnownHeader(cell.text)).length;
    const numeric = line.cells.filter((cell) => /\d/.test(cell.text)).length;
    const score = known * 3 + line.cells.length - numeric * 2;
    if (known >= 2 && score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

/** Where one column sits on the page; `index` points into the table's columns. */
type Span = { index: number; left: number; right: number };

/** The span a cell overlaps the most, else the closest one. */
function spanOf(cell: Cell, spans: readonly Span[]) {
  let best = spans[0]!;
  let bestScore = -Infinity;
  for (const span of spans) {
    const overlap =
      Math.min(cell.right, span.right) - Math.max(cell.left, span.left);
    const center = (cell.left + cell.right) / 2;
    const middle = Number.isFinite(span.left + span.right)
      ? (span.left + span.right) / 2
      : Number.isFinite(span.left)
        ? span.left
        : span.right;
    const score = overlap > 0 ? overlap : -Math.abs(center - middle);
    if (score > bestScore) {
      bestScore = score;
      best = span;
    }
  }
  return { index: best.index, inside: bestScore > 0 };
}

/** Column names shared by all pages: a known name keeps its place. */
function columnIndex(columns: string[], name: string) {
  const key = normalizeHeader(name);
  const found = key
    ? columns.findIndex((column) => normalizeHeader(column) === key)
    : -1;
  if (found >= 0) return found;
  columns.push(name || `Colonne ${columns.length + 1}`);
  return columns.length - 1;
}

/**
 * Pages to one table. Pages without a header line reuse the column positions
 * of the previous page (a long table continues); rows are numbered page ×
 * 1000 + line so the administrator can find them in the PDF.
 */
export function tableFromPages(pages: readonly PageInput[]): {
  table: ExtractedTable;
  pages: PageResult[];
} {
  const columns: string[] = [];
  let spans: Span[] | null = null;
  const rows: TableRow[] = [];
  const results: PageResult[] = [];
  let skipped = 0;
  for (const input of pages) {
    if (!('words' in input)) {
      const read = tableOfPage(input, columns);
      rows.push(...read.rows);
      results.push(read.result);
      continue;
    }
    const { page, words } = input;
    const source = input.label ?? `page ${page}`;
    const lines = linesOf(words);
    const header = headerLine(lines);
    if (header >= 0) {
      const cells = lines[header]!.cells;
      // Column spans reach halfway to the next header: values are rarely
      // aligned exactly under their title (prices are right aligned).
      spans = cells.map((cell, index) => ({
        index: columnIndex(columns, cell.text),
        left: index ? (cells[index - 1]!.right + cell.left) / 2 : -Infinity,
        right:
          index < cells.length - 1
            ? (cell.right + cells[index + 1]!.left) / 2
            : Infinity,
      }));
    }
    if (!spans) {
      results.push({
        page,
        confidence: 0,
        rows: 0,
        headerFound: false,
        note: lines.length ? 'Aucun en-tête de tableau reconnu' : 'Page vide',
      });
      skipped += lines.length;
      continue;
    }
    const pageSpans = spans;
    const first = header >= 0 ? header + 1 : 0;
    let dataLines = 0;
    let filledLines = 0;
    let insideCells = 0;
    let totalCells = 0;
    const pageRows: TableRow[] = [];
    lines.slice(first).forEach((line, offset) => {
      const values = Array.from({ length: columns.length }, () => '');
      for (const cell of line.cells) {
        const { index, inside } = spanOf(cell, pageSpans);
        values[index] = values[index]
          ? `${values[index]} ${cell.text}`
          : cell.text;
        totalCells++;
        if (inside) insideCells++;
      }
      const filled = values.filter(Boolean).length;
      const previous = pageRows.at(-1);
      // A single text cell under a text column: the previous row wraps.
      if (filled === 1 && previous && !/\d/.test(values.find(Boolean)!)) {
        const index = values.findIndex(Boolean);
        previous.cells[index] =
          `${previous.cells[index]} ${values[index]}`.trim();
        return;
      }
      if (filled < 2) {
        skipped++;
        return;
      }
      dataLines++;
      if (filled >= Math.ceil(pageSpans.length / 2)) filledLines++;
      pageRows.push({
        number: page * 1000 + first + offset + 1,
        source,
        cells: values,
      });
    });
    const ocr = words.filter((word) => word.confidence !== undefined);
    const ocrFactor = ocr.length
      ? Math.min(1, median(ocr.map((word) => word.confidence!)) / 90)
      : 1;
    const confidence = dataLines
      ? (0.3 * (header >= 0 || results.some((r) => r.headerFound) ? 1 : 0) +
          0.35 * (filledLines / dataLines) +
          0.35 * (totalCells ? insideCells / totalCells : 0)) *
        ocrFactor
      : 0;
    results.push({
      page,
      confidence: Math.round(confidence * 100) / 100,
      rows: pageRows.length,
      headerFound: header >= 0,
      note: dataLines ? null : 'Aucune ligne de données',
    });
    rows.push(...pageRows);
  }
  // Columns added by a later page: earlier rows get empty cells.
  for (const row of rows)
    while (row.cells.length < columns.length) row.cells.push('');
  return {
    table: { headers: uniqueNames(columns), rows, skipped },
    pages: results,
  };
}

const cleanCell = (value: unknown) =>
  (typeof value === 'string' ? value : '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);

/**
 * A page read by AI joins the table by column name; a page without header
 * row keeps the order of the columns already known.
 */
function tableOfPage(input: PageTable, columns: string[]) {
  const known = columns.length;
  const headers = input.headers.map(cleanCell);
  const indexes = headers.map((name) => columnIndex(columns, name));
  const rows: TableRow[] = [];
  let filledLines = 0;
  input.rows.forEach((cells, line) => {
    const values = Array.from({ length: columns.length }, () => '');
    cells.forEach((cell, position) => {
      const index = headers.length ? indexes[position] : position;
      if (index !== undefined && index < values.length)
        values[index] = cleanCell(cell);
    });
    const filled = values.filter(Boolean).length;
    if (filled < 2) return;
    if (filled >= Math.ceil((headers.length || known) / 2)) filledLines++;
    rows.push({
      number: input.page * 1000 + line + 1,
      source: input.label ?? `page ${input.page}`,
      cells: values,
    });
  });
  const hasHeader = headers.some((name) => isKnownHeader(name));
  // No positions to check: the confidence says how complete the rows are.
  const confidence = rows.length
    ? 0.3 * (hasHeader || known ? 1 : 0) +
      0.35 * (filledLines / rows.length) +
      0.35
    : 0;
  return {
    rows,
    result: {
      page: input.page,
      confidence: Math.round(confidence * 100) / 100,
      rows: rows.length,
      headerFound: hasHeader,
      note: rows.length ? null : 'Aucune ligne de données',
    } satisfies PageResult,
  };
}

function uniqueNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count > 1 ? `${name} (${count})` : name;
  });
}

/** Below this, a page is shown for review (and AI extraction is offered). */
export const PAGE_CONFIDENCE_THRESHOLD = 0.7;
