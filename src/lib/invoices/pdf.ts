import 'server-only';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type { InvoiceSnapshot } from './document';

const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 48;
const RIGHT = WIDTH - MARGIN;
const INK = rgb(0.09, 0.243, 0.196);
const MUTED = rgb(0.376, 0.4, 0.365);
const RULE = rgb(0.847, 0.835, 0.78);
const ACCENT = rgb(0, 0.235, 0.176);
const PANEL = rgb(0.965, 0.945, 0.894);

const euros = (value: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    Number(value),
  );
const day = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'Europe/Paris',
  }).format(new Date(iso));

type Fonts = { regular: PDFFont; bold: PDFFont; supported: Set<number> };

/** The standard PDF fonts only know WinAnsi: other characters are replaced. */
function clean(fonts: Fonts, value: string) {
  return [...value.normalize('NFC')]
    .map((char) => {
      if (/[    ]/.test(char)) return ' ';
      if (/[‐-‒−]/.test(char)) return '-';
      return fonts.supported.has(char.codePointAt(0)!) ? char : '?';
    })
    .join('');
}

function wrap(
  fonts: Fonts,
  font: PDFFont,
  value: string,
  size: number,
  max: number,
) {
  const words = clean(fonts, value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= max || !current) current = next;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

class Writer {
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    private fonts: Fonts,
    private snapshot: InvoiceSnapshot,
  ) {}

  newPage() {
    this.page = this.doc.addPage([WIDTH, HEIGHT]);
    this.pages.push(this.page);
    this.y = HEIGHT - MARGIN;
  }

  text(
    value: string,
    x: number,
    y: number,
    {
      bold = false,
      size = 9,
      color = INK,
      align = 'left',
    }: {
      bold?: boolean;
      size?: number;
      color?: ReturnType<typeof rgb>;
      align?: 'left' | 'right';
    } = {},
  ) {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const safe = clean(this.fonts, value);
    const left = align === 'right' ? x - font.widthOfTextAtSize(safe, size) : x;
    this.page.drawText(safe, { x: left, y, size, font, color });
  }

  rule(y: number, color = RULE) {
    this.page.drawLine({
      start: { x: MARGIN, y },
      end: { x: RIGHT, y },
      thickness: 0.6,
      color,
    });
  }

  /** Room for `height` more points, or a new page with the table header. */
  ensure(height: number, header: () => void) {
    if (this.y - height >= 120) return;
    this.newPage();
    this.text(
      `${this.snapshot.kind === 'INVOICE' ? 'Facture' : 'Avoir'} ${this.snapshot.number} (suite)`,
      MARGIN,
      this.y,
      { bold: true, size: 10 },
    );
    this.y -= 24;
    header();
  }

  wrap(value: string, bold: boolean, size: number, max: number) {
    return wrap(
      this.fonts,
      bold ? this.fonts.bold : this.fonts.regular,
      value,
      size,
      max,
    );
  }
}

/** A4 PDF of a stored invoice or credit note. */
export async function renderInvoicePdf(snapshot: InvoiceSnapshot) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = {
    regular,
    bold,
    supported: new Set(regular.getCharacterSet()),
  };
  const issued = new Date(snapshot.issuedAt);
  const credit = snapshot.kind === 'CREDIT_NOTE';
  const title = credit ? 'AVOIR' : 'FACTURE';
  doc.setTitle(`${credit ? 'Avoir' : 'Facture'} ${snapshot.number}`);
  doc.setAuthor(snapshot.seller.name);
  doc.setCreator(snapshot.seller.tradeName);
  doc.setProducer(snapshot.seller.tradeName);
  doc.setCreationDate(issued);
  doc.setModificationDate(issued);

  const w = new Writer(doc, fonts, snapshot);
  w.newPage();

  // Seller, then the document's identity on the right.
  w.text(snapshot.seller.tradeName, MARGIN, w.y - 6, {
    bold: true,
    size: 17,
    color: ACCENT,
  });
  let left = w.y - 24;
  w.text(snapshot.seller.name, MARGIN, left, { bold: true, size: 9 });
  for (const line of snapshot.seller.lines) {
    left -= 11.5;
    w.text(line, MARGIN, left, { size: 8.5, color: MUTED });
  }
  left -= 11.5;
  w.text(snapshot.seller.email, MARGIN, left, { size: 8.5, color: MUTED });

  let right = w.y - 6;
  w.text(title, RIGHT, right, {
    bold: true,
    size: 20,
    color: ACCENT,
    align: 'right',
  });
  right -= 20;
  w.text(`N° ${snapshot.number}`, RIGHT, right, {
    bold: true,
    size: 10,
    align: 'right',
  });
  right -= 13;
  w.text(`Date : ${day(snapshot.issuedAt)}`, RIGHT, right, { align: 'right' });
  right -= 12;
  w.text(`Commande ${snapshot.order.number}`, RIGHT, right, {
    align: 'right',
    color: MUTED,
  });
  right -= 12;
  w.text(`du ${day(snapshot.order.createdAt)}`, RIGHT, right, {
    align: 'right',
    color: MUTED,
  });

  // Buyer.
  w.y = Math.min(left, right) - 26;
  const buyerLines = [
    snapshot.buyer.name,
    ...snapshot.buyer.lines,
    snapshot.buyer.email,
  ];
  const box = 22 + buyerLines.length * 12;
  w.page.drawRectangle({
    x: WIDTH / 2,
    y: w.y - box + 12,
    width: RIGHT - WIDTH / 2,
    height: box,
    color: PANEL,
  });
  w.text(credit ? 'Client' : 'Facturé à', WIDTH / 2 + 12, w.y, {
    size: 8,
    color: MUTED,
  });
  let buyerY = w.y - 14;
  buyerLines.forEach((line, index) => {
    w.text(line, WIDTH / 2 + 12, buyerY, { bold: index === 0, size: 9.5 });
    buyerY -= 12;
  });
  w.y = w.y - box - 10;
  if (snapshot.reference) {
    w.text(snapshot.reference, MARGIN, w.y, { bold: true, size: 10 });
    w.y -= 20;
  }

  // Lines.
  const standard = snapshot.taxBreakdown.length > 0;
  const columns = {
    quantity: 318,
    unit: 386,
    discount: standard ? 440 : 462,
    rate: 486,
    total: RIGHT,
  };
  const describe = standard ? 225 : 250;
  const header = () => {
    w.page.drawRectangle({
      x: MARGIN,
      y: w.y - 6,
      width: RIGHT - MARGIN,
      height: 18,
      color: ACCENT,
    });
    const white = rgb(1, 1, 1);
    w.text('Désignation', MARGIN + 6, w.y, {
      bold: true,
      size: 8,
      color: white,
    });
    w.text('Qté', columns.quantity, w.y, {
      bold: true,
      size: 8,
      color: white,
      align: 'right',
    });
    w.text('PU TTC', columns.unit, w.y, {
      bold: true,
      size: 8,
      color: white,
      align: 'right',
    });
    w.text('Remise', columns.discount, w.y, {
      bold: true,
      size: 8,
      color: white,
      align: 'right',
    });
    if (standard)
      w.text('TVA', columns.rate, w.y, {
        bold: true,
        size: 8,
        color: white,
        align: 'right',
      });
    w.text(credit ? 'Montant TTC' : 'Total TTC', columns.total - 6, w.y, {
      bold: true,
      size: 8,
      color: white,
      align: 'right',
    });
    w.y -= 22;
  };
  header();
  for (const line of snapshot.lines) {
    const title = w.wrap(line.description, true, 9, describe);
    const detail = line.detail ? w.wrap(line.detail, false, 8, describe) : [];
    const height = title.length * 11 + detail.length * 10 + 8;
    w.ensure(height, header);
    const top = w.y;
    title.forEach((part, index) =>
      w.text(part, MARGIN + 6, top - index * 11, { bold: true, size: 9 }),
    );
    detail.forEach((part, index) =>
      w.text(part, MARGIN + 6, top - title.length * 11 - index * 10, {
        size: 8,
        color: MUTED,
      }),
    );
    w.text(String(line.quantity), columns.quantity, top, { align: 'right' });
    w.text(line.unitPrice ? euros(line.unitPrice) : '—', columns.unit, top, {
      align: 'right',
    });
    w.text(
      Number(line.discount) > 0 ? `-${euros(line.discount)}` : '—',
      columns.discount,
      top,
      { align: 'right' },
    );
    if (standard)
      w.text(
        line.taxRate ? `${line.taxRate.replace('.', ',')} %` : '—',
        columns.rate,
        top,
        { align: 'right' },
      );
    w.text(euros(line.total), columns.total - 6, top, {
      bold: true,
      align: 'right',
    });
    w.y = top - height + 6;
    w.rule(w.y + 2);
    w.y -= 10;
  }

  // Totals.
  const rows: [string, string, boolean][] = credit
    ? []
    : [
        ['Total des articles', euros(snapshot.totals.items), false],
        ...(Number(snapshot.totals.discount) > 0
          ? ([['Remises', `-${euros(snapshot.totals.discount)}`, false]] as [
              string,
              string,
              boolean,
            ][])
          : []),
      ];
  if (standard) {
    rows.push(['Total HT', euros(snapshot.totals.net), false]);
    for (const tax of snapshot.taxBreakdown)
      rows.push([`TVA ${tax.rate.replace('.', ',')} %`, euros(tax.tax), false]);
  }
  rows.push([
    credit
      ? 'Montant de l’avoir TTC'
      : standard
        ? 'Total TTC'
        : 'Total à payer',
    euros(snapshot.totals.total),
    true,
  ]);
  w.ensure(rows.length * 16 + 90, header);
  w.y -= 4;
  for (const [label, value, strong] of rows) {
    if (strong) {
      // Clear of the row above: the panel spans 8 points around the text.
      w.y -= 8;
      w.page.drawRectangle({
        x: 330,
        y: w.y - 8,
        width: RIGHT - 330,
        height: 23,
        color: PANEL,
      });
    }
    w.text(label, 340, w.y, { bold: strong, size: strong ? 10.5 : 9 });
    w.text(value, RIGHT - 6, w.y, {
      bold: strong,
      size: strong ? 10.5 : 9,
      align: 'right',
    });
    w.y -= strong ? 24 : 15;
  }

  // Mentions.
  w.y -= 6;
  for (const paragraph of [
    snapshot.vatMention,
    snapshot.payment,
    snapshot.footer,
  ]) {
    if (!paragraph) continue;
    for (const part of paragraph.split('\n'))
      for (const line of w.wrap(part, false, 8.5, RIGHT - MARGIN)) {
        w.ensure(14, () => undefined);
        w.text(line, MARGIN, w.y, { size: 8.5, color: MUTED });
        w.y -= 12;
      }
    w.y -= 4;
  }

  // Footer on every page.
  const legal = `${snapshot.seller.name} · ${snapshot.seller.lines.slice(0, 1).join('')} · ${snapshot.seller.lines.find((line) => line.startsWith('SIREN')) ?? ''}`;
  w.pages.forEach((page, index) => {
    w.page = page;
    w.rule(58);
    w.text(legal, MARGIN, 44, { size: 7.5, color: MUTED });
    w.text(`Page ${index + 1} / ${w.pages.length}`, RIGHT, 44, {
      size: 7.5,
      color: MUTED,
      align: 'right',
    });
  });
  return doc.save();
}
