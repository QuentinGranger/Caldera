// Scanned pages: rendered to an image, then read by Tesseract on the server
// with the French and English models shipped in node_modules. Nothing leaves
// the server. Server only.
import 'server-only';
import { copyFile, mkdir, rename, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Tesseract from 'tesseract.js';
import { renderPageAsImage } from 'unpdf';
import type { Word } from '../layout';
import { openPdf } from './pdf';

const LANGUAGES = ['fra', 'eng'] as const;

/**
 * Tesseract reads every model from one folder; each ships in its own
 * package, so both are copied once to the temporary folder (the only
 * writable place on Vercel).
 */
async function languageFolder() {
  const folder = join(tmpdir(), 'caldera-ocr-4.0.0_best_int');
  await mkdir(folder, { recursive: true });
  for (const language of LANGUAGES) {
    // From the project root, like content/: the bundler would turn a
    // require.resolve() into a module id. next.config.ts ships the files.
    const source = join(
      process.cwd(),
      'node_modules',
      '@tesseract.js-data',
      language,
      '4.0.0_best_int',
      `${language}.traineddata.gz`,
    );
    const target = join(folder, `${language}.traineddata.gz`);
    const [from, to] = await Promise.all([
      stat(source),
      stat(target).catch(() => null),
    ]);
    if (to?.size !== from.size) {
      const partial = `${target}.${process.pid}.part`;
      await copyFile(source, partial);
      await rename(partial, target);
    }
  }
  return folder;
}

export type OcrPage =
  { page: number; words: Word[] } | { page: number; error: string };

/** About 200 dpi on A4, bounded so a poster-sized page stays fast. */
const MAX_WIDTH = 2400;

async function worker() {
  return Tesseract.createWorker([...LANGUAGES], Tesseract.OEM.LSTM_ONLY, {
    langPath: await languageFolder(),
    gzip: true,
    // Nothing written next to the code: models are read from langPath.
    cacheMethod: 'none',
    logger: () => {},
    errorHandler: () => {},
  });
}

export async function ocrPages(
  bytes: Uint8Array,
  pages: readonly number[],
  /** Stops before this time (ms since epoch); unread pages are returned later. */
  deadline: number,
): Promise<OcrPage[]> {
  const pdf = await openPdf(bytes);
  const results: OcrPage[] = [];
  let reader: Tesseract.Worker | null = null;
  try {
    for (const number of pages) {
      if (results.length && Date.now() > deadline) break;
      try {
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(3, MAX_WIDTH / viewport.width);
        const image = await renderPageAsImage(pdf, number, {
          canvasImport: () => import('@napi-rs/canvas'),
          scale,
        });
        reader ??= await worker();
        const { data } = await reader.recognize(
          Buffer.from(image),
          {},
          { blocks: true, text: false },
        );
        const words: Word[] = [];
        for (const block of data.blocks ?? [])
          for (const paragraph of block.paragraphs)
            for (const line of paragraph.lines)
              for (const word of line.words) {
                const text = word.text.trim();
                if (!text) continue;
                // Back to PDF points, like the pages that have a text layer.
                words.push({
                  text,
                  left: word.bbox.x0 / scale,
                  top: word.bbox.y0 / scale,
                  width: (word.bbox.x1 - word.bbox.x0) / scale,
                  height: (word.bbox.y1 - word.bbox.y0) / scale,
                  confidence: word.confidence,
                });
              }
        results.push({ page: number, words });
      } catch (error) {
        // A controlled code only: the page is marked failed, the others go on.
        console.error(
          JSON.stringify({
            scope: 'supplier-import',
            action: 'ocr_page_failed',
            page: number,
            code: error instanceof Error ? error.name : 'UNKNOWN',
          }),
        );
        results.push({ page: number, error: 'Lecture OCR impossible' });
      }
    }
  } finally {
    await reader?.terminate();
    await pdf.loadingTask.destroy();
  }
  return results;
}
