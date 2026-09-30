import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { renderPageAsImage } from 'unpdf';
import * as XLSX from 'xlsx';
import { tableFromPages } from '../src/lib/supplier-import/layout';
import { suggestMapping } from '../src/lib/supplier-import/mapping';
import { parseExcel } from '../src/lib/supplier-import/parsers/excel';
import { parseJson } from '../src/lib/supplier-import/parsers/json';
import { readPdfText } from '../src/lib/supplier-import/parsers/pdf';
import { ocrPages } from '../src/lib/supplier-import/parsers/ocr';
import {
  AiExtractionError,
  aiExtractPage,
  parseAiAnswer,
} from '../src/lib/supplier-import/parsers/ai';

const CATALOGUE = [
  ['Référence', 'Désignation', 'EAN', 'PA HT', 'Stock'],
  ['ETB-001', 'Coffret Dresseur Elite Flammes', '3760052142223', '39,90', '24'],
  ['DIS-036', 'Display 36 boosters Flammes', '4006381333931', '129,00', '0'],
  ['TRI-003', 'Tripack Flammes', '5901234123457', '14,50', '8'],
];

async function cataloguePdf(pages = 1) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index++) {
    const page = doc.addPage([595, 842]);
    page.drawText('Tarifs professionnels — automne', {
      x: 40,
      y: 800,
      size: 16,
      font,
    });
    // The header only on the first page: the table continues after.
    const rows = index ? CATALOGUE.slice(1) : CATALOGUE;
    rows.forEach((row, line) =>
      row.forEach((cell, column) =>
        page.drawText(cell, {
          x: [40, 110, 330, 440, 510][column]!,
          y: 760 - line * 24,
          size: 11,
          font,
        }),
      ),
    );
  }
  return new Uint8Array(await doc.save());
}

test('Excel: stored values, full EAN, calendar dates, chosen sheet', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Conditions générales'], ['Franco 300 €']]),
    'Conditions',
  );
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Tarif septembre'],
    ['Ref', 'Libellé', 'EAN', 'Prix HT', 'TVA', 'Sortie'],
    ['ETB-001', 'Coffret Dresseur Elite', 3760052142223, 39.9, 0.2, 45930],
    ['DIS-036', 'Display 36 boosters', 4006381333931, 129, 0.055, 45945],
  ]);
  for (const row of [3, 4]) {
    sheet[`E${row}`]!.z = '0.0%';
    sheet[`F${row}`]!.z = 'dd/mm/yyyy';
  }
  XLSX.utils.book_append_sheet(workbook, sheet, 'Tarif');
  const bytes = new Uint8Array(
    XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }),
  );
  const result = parseExcel(bytes, { maxRows: 1000 });
  assert.equal(result.sheet, 'Tarif');
  assert.deepEqual(result.sheets, [
    { name: 'Conditions', rows: 0 },
    { name: 'Tarif', rows: 2 },
  ]);
  assert.deepEqual(result.headers, [
    'Ref',
    'Libellé',
    'EAN',
    'Prix HT',
    'TVA',
    'Sortie',
  ]);
  assert.deepEqual(result.rows[0], {
    number: 3,
    source: 'Feuille Tarif',
    cells: [
      'ETB-001',
      'Coffret Dresseur Elite',
      '3760052142223',
      '39.9',
      '20%',
      '2025-09-30',
    ],
  });
  assert.equal(result.rows[1]!.cells[4], '5.5%');
  // Legacy .xls goes through the same reader.
  const xls = parseExcel(
    new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'biff8' })),
    { sheet: 'Tarif', maxRows: 1000 },
  );
  assert.equal(xls.rows[0]!.cells[2], '3760052142223');
});

test('JSON: nested list, flattened objects', () => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      generated: '2026-09-30',
      data: {
        products: [
          {
            sku: 'A1',
            name: 'Booster',
            price: { ht: 4.5 },
            tags: ['fr', 'new'],
          },
          {
            sku: 'A2',
            name: 'Display',
            price: { ht: 129 },
            ean: 4006381333931,
          },
          {},
        ],
      },
    }),
  );
  const result = parseJson(bytes, 1000);
  assert.equal(result.path, 'data.products');
  assert.deepEqual(result.headers, ['sku', 'name', 'price.ht', 'tags', 'ean']);
  assert.deepEqual(result.rows[1]!.cells, [
    'A2',
    'Display',
    '129',
    '',
    '4006381333931',
  ]);
  assert.equal(result.skipped, 1);
  assert.throws(
    () => parseJson(new TextEncoder().encode('{"a":'), 10),
    /illisible/,
  );
});

test('PDF text layer: positioned words become the table, page after page', async () => {
  const bytes = await cataloguePdf(2);
  const read = await readPdfText(bytes, 50);
  assert.equal(read.pageCount, 2);
  assert.ok(read.pages.every((page) => !page.scanned));
  const { table, pages } = tableFromPages(read.pages);
  assert.deepEqual(table.headers, CATALOGUE[0]);
  assert.equal(table.rows.length, 6);
  assert.deepEqual(table.rows[0]!.cells, CATALOGUE[1]);
  assert.deepEqual(table.rows[3]!.cells, CATALOGUE[1]);
  assert.equal(table.rows[3]!.source, 'page 2');
  assert.ok(pages.every((page) => page.confidence >= 0.9));
});

test('scanned PDF: no text layer, read by local OCR', async () => {
  const text = await cataloguePdf(1);
  const png = await renderPageAsImage(text.slice(), 1, {
    canvasImport: () => import('@napi-rs/canvas'),
    scale: 2.5,
  });
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(new Uint8Array(png));
  doc
    .addPage([595, 842])
    .drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
  const scan = new Uint8Array(await doc.save());
  const read = await readPdfText(scan, 50);
  assert.deepEqual(
    read.pages.map((page) => page.scanned),
    [true],
  );
  const [ocr] = await ocrPages(scan, [1], Date.now() + 60_000);
  assert.ok(ocr && 'words' in ocr, 'OCR failed');
  const { table, pages } = tableFromPages([
    { page: 1, words: ocr.words, label: 'page 1 · OCR' },
  ]);
  // OCR may drop the space in « PA HT »: still a known column name.
  assert.equal(table.headers.length, 5);
  assert.equal(
    suggestMapping(table.headers, []).mapping.purchasePrice,
    table.headers[3],
  );
  assert.equal(table.rows.length, 3);
  assert.equal(table.rows[0]!.source, 'page 1 · OCR');
  assert.deepEqual(table.rows[1]!.cells.slice(0, 1), ['DIS-036']);
  assert.equal(table.rows[0]!.cells[2], '3760052142223');
  assert.ok(pages[0]!.confidence > 0.7, `confidence ${pages[0]!.confidence}`);
});

test('AI fallback: one page sent, strict table answer, joins by column name', async () => {
  const bytes = await cataloguePdf(3);
  const calls: { url: string; body: Record<string, unknown>; key: string }[] =
    [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)),
      key: new Headers(init.headers).get('x-api-key') ?? '',
    });
    return new Response(
      JSON.stringify({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            name: 'record_table',
            input: {
              headers: ['Désignation', 'Référence', 'PA HT'],
              rows: [
                ['Bundle 6 boosters', 'BUN-006', '26,40'],
                ['Total', ''],
              ],
            },
          },
        ],
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  const table = await aiExtractPage({
    bytes,
    page: 2,
    expectedHeaders: CATALOGUE[0]!,
    apiKey: 'test-key',
    fetch: fakeFetch,
  });
  assert.equal(calls.length, 1);
  const request = calls[0]!;
  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(request.key, 'test-key');
  const content = (
    request.body.messages as {
      content: { type: string; source?: { data: string } }[];
    }[]
  )[0]!.content;
  const pdf = await PDFDocument.load(
    Buffer.from(content[0]!.source!.data, 'base64'),
  );
  assert.equal(pdf.getPageCount(), 1, 'only the page is sent');
  // AI table joins the text pages by column name.
  const read = await readPdfText(bytes, 50);
  const assembled = tableFromPages([
    read.pages[0]!,
    { page: 2, ...table, label: 'page 2 · IA' },
  ]);
  assert.deepEqual(assembled.table.headers, CATALOGUE[0]);
  const aiRow = assembled.table.rows.find(
    (row) => row.source === 'page 2 · IA',
  );
  assert.deepEqual(aiRow!.cells, [
    'BUN-006',
    'Bundle 6 boosters',
    '',
    '26,40',
    '',
  ]);
  assert.equal(
    assembled.table.rows.filter((row) => row.source === 'page 2 · IA').length,
    1,
    'the total line is not a product',
  );
  assert.throws(
    () => parseAiAnswer({ stop_reason: 'max_tokens', content: [] }),
    AiExtractionError,
  );
  assert.throws(
    () => parseAiAnswer({ content: [{ type: 'text' }] }),
    /inexploitable/,
  );
  await assert.rejects(
    aiExtractPage({ bytes, page: 1, expectedHeaders: [], apiKey: '' }),
    /non configurée/,
  );
});
