/** Longest customer text quoted in a reply link (mail clients cut long mailto). */
const QUOTE_MAX = 700;

/**
 * A mailto: link that opens a fresh message to the customer, ready to write:
 * a subject that reads well on their side, a greeting, the signature, and
 * their own words quoted below. Nothing internal is quoted, unlike a plain
 * "Reply" to a notification.
 */
export function customerReplyLink({
  to,
  subject,
  name,
  quote,
}: {
  to: string;
  subject: string;
  /** Full name: the first word greets. */
  name?: string | null;
  /** The customer's own message, quoted under the signature. */
  quote?: string | null;
}) {
  const first = name?.trim().split(/\s+/)[0];
  const quoted = quote?.trim()
    ? [
        '',
        '———',
        'Votre message :',
        ...(quote.trim().length > QUOTE_MAX
          ? `${quote.trim().slice(0, QUOTE_MAX)}…`
          : quote.trim()
        )
          .split(/\r?\n/)
          .map((line) => `> ${line}`),
      ]
    : [];
  const body = [
    `Bonjour${first ? ` ${first}` : ''},`,
    '',
    '',
    '',
    'Bien à vous,',
    'Les Terres de Caldera',
    ...quoted,
  ].join('\n');
  // RFC 6068: the address and every header value percent-encoded.
  return `mailto:${encodeURIComponent(to).replace('%40', '@')}?subject=${encodeURIComponent(subject.replace(/[\r\n]+/g, ' '))}&body=${encodeURIComponent(body)}`;
}
