import 'server-only';
import { parseInvoiceSnapshot } from './document';
import { renderInvoicePdf } from './pdf';

/** Private, never cached nor indexed: an invoice carries personal data. */
export async function invoicePdfResponse(invoice: {
  number: string;
  snapshot: unknown;
}) {
  const pdf = await renderInvoicePdf(parseInvoiceSnapshot(invoice.snapshot));
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.number}.pdf"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
