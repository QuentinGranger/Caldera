import {
  parseNewsletterDocument,
  serializeNewsletterDocument,
  type NewsletterDocument,
} from './document';
export type NewsletterRecoveryFields = {
  internalName: string;
  subject: string;
  preheader: string;
  heading: string;
};

export type NewsletterBackup = {
  savedAt: number;
  value: Pick<
    NewsletterRecoveryFields,
    'internalName' | 'subject' | 'preheader' | 'heading'
  >;
  doc: NewsletterDocument;
};
export function validateNewsletterBackup(raw: string): NewsletterBackup {
  if (raw.length > 75000) throw new Error('too large');
  const b = JSON.parse(raw) as NewsletterBackup;
  if (
    !b ||
    !Number.isFinite(b.savedAt) ||
    Date.now() - b.savedAt > 86400000 ||
    b.savedAt > Date.now() + 60000
  )
    throw new Error('expired');
  for (const [key, max] of [
    ['internalName', 120],
    ['subject', 160],
    ['preheader', 180],
    ['heading', 160],
  ] as const)
    if (typeof b.value?.[key] !== 'string' || b.value[key].length > max)
      throw new Error('invalid');
  const doc = parseNewsletterDocument(serializeNewsletterDocument(b.doc));
  if (!doc) throw new Error('invalid');
  return {
    savedAt: b.savedAt,
    value: {
      internalName: b.value.internalName,
      subject: b.value.subject,
      preheader: b.value.preheader,
      heading: b.value.heading,
    },
    doc,
  };
}
export const newsletterRecoverySnapshot = (
  value: NewsletterBackup['value'],
  doc: NewsletterDocument,
) =>
  JSON.stringify({
    value: {
      internalName: value.internalName.trim(),
      subject: value.subject.trim(),
      preheader: value.preheader.trim(),
      heading: value.heading.trim(),
    },
    doc: parseNewsletterDocument(serializeNewsletterDocument(doc)),
  });
