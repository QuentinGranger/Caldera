// PDF text layer, page by page, as positioned words for the layout step.
// A page without usable text (a scan) is left for OCR. Server only.
import 'server-only';
import { getDocumentProxy } from 'unpdf';
import type { Word } from '../layout';
import { ImportFileError } from '../table';

export type PdfTextPage = {
  page: number;
  words: Word[];
  /** No usable text layer: the page is an image. */
  scanned: boolean;
};

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

const isTextItem = (item: unknown): item is TextItem =>
  typeof item === 'object' &&
  item !== null &&
  'str' in item &&
  'transform' in item;

/** A copy is passed: pdf.js may take ownership of the buffer. */
export async function openPdf(bytes: Uint8Array) {
  try {
    return await getDocumentProxy(bytes.slice(), { stopAtErrors: false });
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new ImportFileError(
        'PDF protégé par mot de passe : demandez une version sans protection.',
      );
    throw new ImportFileError('PDF illisible ou endommagé.');
  }
}

/** Runs of text split into words, each placed by its share of the run. */
function wordsOf(item: TextItem, left: number, top: number, height: number) {
  const words: Word[] = [];
  const length = item.str.length;
  if (!length) return words;
  const pattern = /\S+/g;
  for (const match of item.str.matchAll(pattern)) {
    const offset = match.index ?? 0;
    words.push({
      text: match[0],
      left: left + (item.width * offset) / length,
      top,
      width: (item.width * match[0].length) / length,
      height,
    });
  }
  return words;
}

/** Share of the text that reads as words (fonts without mapping give symbols). */
function readable(text: string) {
  const letters = text.replace(/\s/g, '');
  if (!letters.length) return 0;
  const usual = letters.match(/[\p{L}\p{N}.,;:€%()/'’"«»+&-]/gu)?.length ?? 0;
  return usual / letters.length;
}

export async function readPdfText(
  bytes: Uint8Array,
  maxPages: number,
): Promise<{ pageCount: number; pages: PdfTextPage[] }> {
  const pdf = await openPdf(bytes);
  try {
    const pages: PdfTextPage[] = [];
    const count = Math.min(pdf.numPages, maxPages);
    for (let number = 1; number <= count; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const words: Word[] = [];
      let text = '';
      for (const item of content.items) {
        if (!isTextItem(item) || !item.str.trim()) continue;
        const [, , c = 0, d = 0, e = 0, f = 0] = item.transform;
        const size = item.height || Math.hypot(c, d) || 10;
        // Baseline to the top left corner of the page, rotation included.
        const [x, y] = viewport.convertToViewportPoint(e, f) as [
          number,
          number,
        ];
        words.push(...wordsOf(item, x, y - size, size));
        text += `${item.str} `;
      }
      page.cleanup();
      const scanned =
        text.replace(/\s/g, '').length < 15 || readable(text) < 0.6;
      pages.push({ page: number, words: scanned ? [] : words, scanned });
    }
    return { pageCount: pdf.numPages, pages };
  } finally {
    await pdf.loadingTask.destroy();
  }
}
